#!/usr/bin/env bash

docker kill hootnshoot || true 
docker rm hootnshoot || true 
docker create --name hootnshoot -p 3000:3000 -p 4200:4200 localhost/hootnshoot
