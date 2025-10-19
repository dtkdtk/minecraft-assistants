#!/bin/sh
#CWD: /test/prod-test/

cd ../../
sh ./scripts/full-build.sh
mv -r ./build/* ./test/prod-test
rmdir ./build
