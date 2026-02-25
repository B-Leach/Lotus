#!/bin/bash
cd $LAMBDA_TASK_ROOT
exec /var/lang/bin/python3 -m uvicorn index:app --host 0.0.0.0 --port 8000
