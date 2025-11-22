import { describe, it as testCase } from "node:test";
import { setTimeout as wait } from "node:timers/promises";
import assert from "node:assert";
import { ctxErr } from "./_lib.js";
import JobManager from "../../dist/core/job_management/JobManager.js";

class JobA {
  jobIdentifier = Symbol();
  jobDisplayName = "A";
  createdAt = 0;
  priority = 10;
  __resultsArray = [];

  prepare(isActual) {
    this.__resultsArray.push("prepare : " + isActual());
    return true;
  }
  async execute(isActual) {
    this.__resultsArray.push("start execute : " + isActual());
    await wait(100);
    this.__resultsArray.push("end execute : " + isActual());
    return false;
  }
  finalize() {
    this.__resultsArray.push("finalize");
  }
  handleError(error) {}
}

class JobB {
  jobIdentifier = Symbol();
  jobDisplayName = "B";
  createdAt = 0;
  priority = 11;
  __resultsArray = [];

  prepare(isActual) {
    this.__resultsArray.push("prepare : " + isActual());
    return true;
  }
  async execute(isActual) {
    this.__resultsArray.push("start execute : " + isActual());
    await wait(1000);
    this.__resultsArray.push("end execute : " + isActual());
    return false;
  }
  finalize() {
    this.__resultsArray.push("finalize");
  }
  handleError(error) {}
}

describe("job management (JobManager)", () => {
  testCase("simple case", async (t) => {
    const manager = new JobManager();
    const J = new JobA();
    const E = (msg) => ctxErr(msg, J.__resultsArray);
    manager.add(J);
    await wait(110);
    assert(
      J.__resultsArray.indexOf("prepare : false") === -1,
      E("in prepare(ac), ac() must return true")
    );
    assert(
      J.__resultsArray.indexOf("prepare : true") === 0,
      E("prepare() must be called first")
    );
    assert(
      J.__resultsArray.indexOf("start execute : false") === -1,
      E("in execute(ac), ac() must return true [step:start]")
    );
    assert(
      J.__resultsArray.indexOf("end execute : false") === -1,
      E("in execute(ac), ac() must return true [step:end]")
    );
    assert(
      J.__resultsArray.indexOf("end execute : true") >
        J.__resultsArray.indexOf("start execute : true"),
      E("in execute(ac), ac() must return true [step:end]")
    );
    assert(
      J.__resultsArray.indexOf("finalize") === J.__resultsArray.length - 1,
      E("finalize() must be called last")
    );
    assert(
      manager.exists(J) === false,
      E("job is not deleted from queue after finalization")
    );
  });

  testCase("finalize always called for interrupted jobs", async (t) => {
    const manager = new JobManager();

    let finalizeCallCount = 0;
    class TrackedJob extends JobA {
      finalize() {
        finalizeCallCount++;
        this.__resultsArray.push("finalize called");
      }
    }

    const jobA = new TrackedJob();
    const jobB = new JobB();
    const E = (msg) =>
      ctxErr(msg, { A: jobA.__resultsArray, B: jobB.__resultsArray });
    jobB.priority = 100;

    manager.add(jobA);
    await wait(50); // Позволяем начать выполнение
    manager.add(jobB); // Прерываем jobA

    await wait(200);

    assert(
      finalizeCallCount === 1,
      E("finalize should be called even for interrupted jobs")
    );
    assert(
      jobA.__resultsArray.includes("finalize called"),
      E("Interrupted job should have finalize in results")
    );
  });

  testCase("finalize called on prepare interruption", async (t) => {
    class PrepareInterruptJob extends JobA {
      async prepare(isActual) {
        this.__resultsArray.push("prepare start");
        await wait(100);
        return true;
      }

      finalize() {
        this.__resultsArray.push("finalize during prepare");
      }
    }

    const manager = new JobManager();
    const jobA = new PrepareInterruptJob();
    const jobB = new JobB();
    const E = (msg) =>
      ctxErr(msg, { A: jobA.__resultsArray, B: jobB.__resultsArray });
    jobB.priority = 100;

    manager.add(jobA);
    await wait(10);
    manager.add(jobB); // Прерываем во время prepare

    await wait(200);

    assert(
      jobA.__resultsArray.includes("finalize during prepare"),
      E("finalize must be called even when interrupted during prepare")
    );
  });

  testCase("interrupt job that is finalizing", async (t) => {
    class FinalizingJob extends JobA {
      async execute(isActual) {
        this.__resultsArray.push("execute start");
        await wait(50);
        this.__resultsArray.push("execute end");
        return true;
      }

      async finalize() {
        this.__resultsArray.push("finalize start");
        await wait(100); // Долгая финализация
        this.__resultsArray.push("finalize end");
      }
    }

    const manager = new JobManager();
    const jobA = new FinalizingJob();
    const jobB = new JobB();
    const E = (msg) =>
      ctxErr(msg, { A: jobA.__resultsArray, B: jobB.__resultsArray });
    jobB.priority = 100;

    manager.add(jobA);
    await wait(80); // JobA начинает финализацию
    manager.add(jobB); // Прерываем во время финализации

    await wait(200);

    // Проверяем корректность состояний
    assert(
      jobA.__resultsArray.includes("finalize start"),
      E("Job should start finalization")
    );
    assert(
      jobB.__resultsArray.includes("end execute : true"),
      E("High priority job should execute")
    );
  });

  testCase("error handling during interruption", async (t) => {
    class ErrorJob extends JobA {
      async finalize() {
        throw new Error("Finalization failed");
      }
    }

    const manager = new JobManager();
    const errorJob = new ErrorJob();
    const hpJob = new JobB();
    const E = (msg) =>
      ctxErr(msg, {
        errorJob: errorJob.__resultsArray,
        hpJob: hpJob.__resultsArray,
      });
    hpJob.priority = 100;

    manager.add(errorJob);
    await wait(10);

    // Не должно падать при ошибке в finalize прерываемой задачи
    assert.doesNotThrow(() => {
      manager.add(hpJob);
    }, E("Should handle errors in finalize during interruption"));

    await wait(100);

    assert(
      hpJob.__resultsArray.includes("start execute : true"),
      E("High priority job should execute despite errors in previous job")
    );
  });

  testCase("rapid add/terminate race condition", async (t) => {
    const manager = new JobManager();
    const J = new JobA();
    const E = (msg) => ctxErr(msg, J.__resultsArray);

    // Быстро добавляем и удаляем
    manager.add(J);
    const terminatePromise = manager.terminate(J);
    manager.add(J); // Пытаемся добавить снова

    const terminated = await terminatePromise;

    assert(terminated === true, E("Terminate should succeed"));
    assert(
      manager.exists(J) === true,
      E("Job should be in queue after re-add")
    );
  });

  testCase("actuality check edge cases", async (t) => {
    class ActualityCheckJob extends JobA {
      async execute(isActual) {
        this.__resultsArray.push("execute start: " + isActual());

        // Симулируем удаление задачи из очереди во время выполнения
        setTimeout(() => {
          this.__resultsArray.push("self remove simulated");
        }, 30);

        await wait(100);
        this.__resultsArray.push("execute end: " + isActual());
        return true;
      }
    }

    const manager = new JobManager();
    const J = new ActualityCheckJob();
    const E = (msg) => ctxErr(msg, J.__resultsArray);

    manager.add(J);
    await wait(150);

    // Проверяем поведение при изменении актуальности во время выполнения
    assert(
      J.__resultsArray.includes("execute start: true"),
      E("Job should start as actual")
    );
  });
});
