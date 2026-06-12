#!/bin/bash

set -o xtrace

docker rmi localhost/hootnshoot || true
docker build --target dist -t localhost/hootnshoot -f Dockerfile.dev .
docker build --target devcontainer -t localhost/hootnshoot-devcontainer -f Dockerfile.dev .
