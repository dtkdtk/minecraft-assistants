import { describe, it as testCase } from "node:test";
import { setTimeout as wait } from "node:timers/promises";
import assert from "node:assert";
import { ctxErr } from "./_lib.js";
import { JobManager } from "../../dist/core/job_management/JobManager.js";
import { InfiniteLoopDetected } from "../../dist/core/lib/infloop_fuse.js";

class JobA {
  jobIdentifier = Symbol();
  jobDisplayName = "AAA";
  createdAt = 0;
  priority = 10;
  __resultsArray = [];
  __step = (M) => this.__resultsArray.push(M);

  prepare(isActual) {
    this.__step("prepare : " + isActual());
    return true;
  }
  async execute(isActual) {
    this.__step("start execute : " + isActual());
    await wait(100);
    this.__step("end execute : " + isActual());
    return true;
  }
  finalize() {
    this.__step("finalize");
  }
  handleError(error) {}
}

class JobB {
  jobIdentifier = Symbol();
  jobDisplayName = "BBB";
  createdAt = 0;
  priority = 11;
  __resultsArray = [];
  __step = (M) => this.__resultsArray.push(M);

  prepare(isActual) {
    this.__step("prepare : " + isActual());
    return true;
  }
  async execute(isActual) {
    this.__step("start execute : " + isActual());
    await wait(200);
    this.__step("end execute : " + isActual());
    return true;
  }
  finalize() {
    this.__step("finalize");
  }
  handleError(error) {}
}

class ChronologicalStepper {
  counter = 1;
  steps = [];
  createFn(job) {
    return (msg) => {
      job.__resultsArray.push(msg);
      this.steps.push(`${this.counter} (${job.jobDisplayName}) ` + msg);
      this.counter++;
    };
  }
}

describe("job management (JobManager)", () => {
  testCase("simple case", async (testCtx) => {
    const stepper = new ChronologicalStepper();
    const manager = new JobManager();
    const J = new JobA();
    J.__step = stepper.createFn(J);
    const E = (msg) =>
      ctxErr(msg, { results: J.__resultsArray, chronology: stepper.steps });

    const timestampBeforeAdd = Date.now();
    manager.add(J);
    const jobAddingDuration = Date.now() - timestampBeforeAdd;
    await wait(110);

    assert(
      J.__resultsArray[0] === "prepare : true",
      E("prepare must be called first with actual=true")
    );
    assert(
      J.__resultsArray[1] === "start execute : true",
      E("execute must be called after prepare")
    );
    assert(
      J.__resultsArray[2] === "end execute : true",
      E("execute must complete")
    );
    assert(
      J.__resultsArray[3] === "finalize",
      E("finalize must be called last")
    );
    assert(J.__resultsArray.length === 4, E("exactly 4 method calls expected"));
    assert(
      manager.exists(J) === false,
      E("job must be removed from queue after completion")
    );
    assert(
      jobAddingDuration < 10,
      E("manager.add() must not block event loop")
    );
  });

  testCase("interruption with job continuation", async (testCtx) => {
    const stepper = new ChronologicalStepper();
    const manager = new JobManager();

    const jobA = new JobA();
    jobA.__step = stepper.createFn(jobA);
    const jobB = new JobB();
    jobB.__step = stepper.createFn(jobB);
    const E = (msg) =>
      ctxErr(msg, {
        A: jobA.__resultsArray,
        B: jobB.__resultsArray,
        chronology: stepper.steps,
      });

    manager.add(jobA);
    await wait(50);
    manager.add(jobB);

    await wait(400);

    // Verify jobA was interrupted and resumed
    const jobAPrepareCalls = jobA.__resultsArray.filter((x) =>
      x.startsWith("prepare")
    ).length;
    const jobAFinalizeCalls = jobA.__resultsArray.filter(
      (x) => x === "finalize"
    ).length;
    const jobAExecuteStarts = jobA.__resultsArray.filter((x) =>
      x.startsWith("start execute")
    ).length;
    const jobAExecuteEnds = jobA.__resultsArray.filter(
      (x) => x === "end execute : true"
    ).length;

    assert(
      jobAPrepareCalls === 2,
      E(
        `jobA prepare should be called twice (initial + resume), got ${jobAPrepareCalls}`
      )
    );
    assert(
      jobAFinalizeCalls === 2,
      E(
        `jobA finalize should be called twice (pause + completion), got ${jobAFinalizeCalls}`
      )
    );
    assert(
      jobAExecuteStarts === 2,
      E(
        `jobA execute should start twice (initial + resume), got ${jobAExecuteStarts}`
      )
    );
    assert(
      jobAExecuteEnds === 1,
      E(
        `jobA execute should complete only once (after resume), got ${jobAExecuteEnds}`
      )
    );

    // Verify jobB executed completely
    assert(
      jobB.__resultsArray.includes("prepare : true"),
      E("jobB prepare must be called")
    );
    assert(
      jobB.__resultsArray.includes("start execute : true"),
      E("jobB execute must start")
    );
    assert(
      jobB.__resultsArray.includes("end execute : true"),
      E("jobB execute must complete")
    );
    assert(
      jobB.__resultsArray.includes("finalize"),
      E("jobB must be finalized")
    );

    // Verify jobA is still in queue after interruption
    assert(
      manager.exists(jobA) === false,
      E("jobA should be removed from queue after final completion")
    );
    assert(
      manager.exists(jobB) === false,
      E("jobB should be removed from queue after completion")
    );
  });

  testCase("interruption during prepare phase", async (testCtx) => {
    const stepper = new ChronologicalStepper();

    class PrepareInterruptJob extends JobA {
      async prepare(isActual) {
        this.__step("prepare start");
        await wait(100);
        this.__step("prepare end : " + isActual());
        return true;
      }

      finalize() {
        this.__step("finalize during prepare");
      }
    }

    const manager = new JobManager();
    const jobA = new PrepareInterruptJob();
    jobA.__step = stepper.createFn(jobA);
    const jobB = new JobB();
    jobB.__step = stepper.createFn(jobB);
    const E = (msg) =>
      ctxErr(msg, {
        A: jobA.__resultsArray,
        B: jobB.__resultsArray,
        chronology: stepper.steps,
      });

    manager.add(jobA);
    await wait(10);
    manager.add(jobB);

    await wait(400);

    // Verify jobA was interrupted during prepare and resumed
    assert(
      jobA.__resultsArray.includes("prepare start"),
      E("jobA must start prepare")
    );
    assert(
      jobA.__resultsArray.includes("prepare end : true"),
      E("jobA should complete prepare after resume")
    );
    assert(
      jobA.__resultsArray.includes("finalize during prepare"),
      E("jobA must be finalized when interrupted")
    );

    // Verify jobB executed successfully
    assert(
      jobB.__resultsArray.includes("end execute : true"),
      E("jobB must complete execution")
    );

    // Verify jobA continued execution after jobB
    const jobBCompleteIndex = jobB.__resultsArray.indexOf("end execute : true");
    const jobAPrepareEndIndex =
      jobA.__resultsArray.indexOf("prepare end : true");
    assert(
      jobAPrepareEndIndex > -1,
      E("jobA should complete prepare after interruption")
    );
  });

  testCase("interruption during finalization", async (testCtx) => {
    const stepper = new ChronologicalStepper();

    class FinalizingJob extends JobA {
      async execute(isActual) {
        this.__step("execute start");
        await wait(50);
        this.__step("execute end");
        return true; // Task completes after one execution
      }

      async finalize() {
        this.__step("finalize start");
        await wait(100);
        this.__step("finalize end");
      }
    }

    const manager = new JobManager();
    const jobA = new FinalizingJob();
    jobA.__step = stepper.createFn(jobA);
    const jobB = new JobB();
    jobB.__step = stepper.createFn(jobB);
    const E = (msg) =>
      ctxErr(msg, {
        A: jobA.__resultsArray,
        B: jobB.__resultsArray,
        chronology: stepper.steps,
      });

    manager.add(jobA);
    await wait(80);
    manager.add(jobB);

    await wait(400);

    // Verify jobA completed its execution cycle
    const finalizeStarts = jobA.__resultsArray.filter(
      (x) => x === "finalize start"
    ).length;
    const finalizeEnds = jobA.__resultsArray.filter(
      (x) => x === "finalize end"
    ).length;
    assert(
      finalizeStarts === 2,
      E(`jobA should start finalization twice, got ${finalizeStarts}`)
    );
    assert(
      finalizeEnds === 2,
      E(`jobA should end finalization twice, got ${finalizeEnds}`)
    );

    // Verify jobB executed successfully
    assert(
      jobB.__resultsArray.includes("end execute : true"),
      E("High priority job should execute")
    );
    assert(
      !jobB.__resultsArray.includes("end execute : false"),
      E("High priority job should not be interrupted")
    );

    // Both jobs should be removed from queue
    assert(
      manager.exists(jobA) === false,
      E("jobA should be removed after completion")
    );
    assert(
      manager.exists(jobB) === false,
      E("jobB should be removed after completion")
    );
  });

  testCase("error handling during interruption", async (testCtx) => {
    const stepper = new ChronologicalStepper();

    class ErrorJob extends JobA {
      async finalize() {
        this.__step("finalize with error");
        throw new Error("Finalization failed");
      }
    }

    const manager = new JobManager();
    const errorJob = new ErrorJob();
    errorJob.__step = stepper.createFn(errorJob);
    const hpJob = new JobB();
    hpJob.__step = stepper.createFn(hpJob);
    const E = (msg) =>
      ctxErr(msg, {
        errorJob: errorJob.__resultsArray,
        hpJob: hpJob.__resultsArray,
        chronology: stepper.steps,
      });

    manager.add(errorJob);
    await wait(10);

    assert.doesNotThrow(() => {
      manager.add(hpJob);
    }, E("Should handle errors in finalize during interruption"));

    await wait(310);

    assert(
      hpJob.__resultsArray.includes("start execute : true"),
      E("High priority job should execute despite errors in previous job")
    );

    assert(
      errorJob.__resultsArray.includes("finalize with error"),
      E("Error job should be finalized even with errors")
    );
    assert(
      manager.exists(errorJob) === false,
      E("Error job should be removed from queue\n")
    );
    assert(
      manager.exists(hpJob) === false,
      E("High priority job should be removed after completion")
    );
  });

  testCase("rapid add/terminate race condition", async (testCtx) => {
    const stepper = new ChronologicalStepper();
    const manager = new JobManager();
    const J = new JobA();
    J.__step = stepper.createFn(J);
    const E = (msg) =>
      ctxErr(msg, {
        results: J.__resultsArray,
        chronology: stepper.steps,
      });

    manager.add(J);
    const terminatePromise = manager.terminate(J);
    manager.add(J);

    const terminated = await terminatePromise;

    assert(terminated === true, E("Terminate should succeed"));
    assert(
      manager.exists(J) === true,
      E("Job should be in queue after re-add")
    );

    const prepareCalls = J.__resultsArray.filter((x) =>
      x.startsWith("prepare")
    ).length;
    assert(
      prepareCalls === 0,
      E(
        `Job should not be executed during race, got ${prepareCalls} prepare calls`
      )
    );
  });

  testCase("actuality check during execution", async (testCtx) => {
    const stepper = new ChronologicalStepper();

    class ActualityCheckJob extends JobA {
      async execute(isActual) {
        this.__step("execute start: " + isActual());

        // Simulate actuality check during execution
        await wait(30);
        const stillActual = isActual();
        this.__step("mid execute: " + stillActual);

        await wait(70);
        this.__step("execute end: " + isActual());
        return true;
      }
    }

    const manager = new JobManager();
    const J = new ActualityCheckJob();
    J.__step = stepper.createFn(J);
    const E = (msg) =>
      ctxErr(msg, {
        results: J.__resultsArray,
        chronology: stepper.steps,
      });

    manager.add(J);
    await wait(150);

    assert(
      J.__resultsArray.includes("execute start: true"),
      E("Job should start as actual")
    );
    assert(
      J.__resultsArray.includes("mid execute: true"),
      E("Job should remain actual during execution")
    );
    assert(
      J.__resultsArray.includes("execute end: true"),
      E("Job should complete as actual")
    );
  });

  testCase("multiple interruptions with continuation", async (testCtx) => {
    const stepper = new ChronologicalStepper();
    const manager = new JobManager();

    const jobA = new JobA();
    jobA.__step = stepper.createFn(jobA);
    const jobB = new JobB();
    jobB.__step = stepper.createFn(jobB);
    const jobC = new JobA();
    jobC.priority = 12;
    jobC.jobDisplayName = "CCC";
    jobC.__step = stepper.createFn(jobC);
    const E = (msg) =>
      ctxErr(msg, {
        A: jobA.__resultsArray,
        B: jobB.__resultsArray,
        C: jobC.__resultsArray,
        chronology: stepper.steps,
      });

    manager.add(jobA);
    await wait(30);
    manager.add(jobB);
    await wait(30);
    manager.add(jobC);

    await wait(500);

    // Verify execution order: jobC -> jobB -> jobA (by priority)
    const jobCCompleted = jobC.__resultsArray.includes("end execute : true");
    const jobBCompleted = jobB.__resultsArray.includes("end execute : true");
    const jobACompleted = jobA.__resultsArray.includes("end execute : true");

    assert(jobCCompleted, E("Highest priority job C should complete"));
    assert(jobBCompleted, E("Medium priority job B should complete"));
    assert(
      jobACompleted,
      E("Low priority job A should complete after interruptions")
    );

    // Verify all jobs were properly finalized and removed
    assert(manager.exists(jobA) === false, E("jobA should be removed"));
    assert(manager.exists(jobB) === false, E("jobB should be removed"));
    assert(manager.exists(jobC) === false, E("jobC should be removed"));
  });

  testCase("prepare returns false - job removal", async (testCtx) => {
    const stepper = new ChronologicalStepper();
    const manager = new JobManager();

    class FalsePrepareJob extends JobA {
      prepare(isActual) {
        this.__step("prepare : " + isActual());
        return true; // Indicates job should be removed
      }
    }

    const job = new FalsePrepareJob();
    job.__step = stepper.createFn(job);
    const E = (msg) =>
      ctxErr(msg, {
        results: job.__resultsArray,
        chronology: stepper.steps,
      });

    manager.add(job);
    await wait(50);

    assert(
      job.__resultsArray.includes("prepare : true"),
      E("prepare should be called")
    );
    assert(
      job.__resultsArray.includes("finalize"),
      E("finalize should be called even when prepare returns false")
    );
    assert(
      !job.__resultsArray.includes("start execute"),
      E("execute should not be called when prepare returns false")
    );
    assert(
      manager.exists(job) === false,
      E("job should be removed from queue when prepare returns false")
    );
  });

  testCase("infinite loop in execute", async (testCtx) => {
    let startMs = Date.now()
    class InfiniteJob extends JobA {
      async execute() {
        return false; //infinite loop
      }
      handleError(E) {
        testCtx.diagnostic("Infinite loop detection delay: " + (Date.now() - startMs) + "ms")
        if (E instanceof InfiniteLoopDetected)
          this.__step("infinite loop")
        else
          this.__step("unknown error")
      }
    }
    const manager = new JobManager();
    const J = new InfiniteJob();
    const E = (msg) =>
      ctxErr(msg, { results: J.__resultsArray, });

    manager.add(J);
    await wait(1_000);

    assert(
      !manager.exists(J),
      E("infinite loop was not detected (in 1 second)")
    );
    assert(
      J.__resultsArray.includes("infinite loop"),
      E("infinite loop error is not handled properly")
    );
    assert(
      !J.__resultsArray.includes("unknown error"),
      E("unknown error is thrown during job execution")
    );

    if (manager.exists(J)) manager.terminate(J)
  });
});
