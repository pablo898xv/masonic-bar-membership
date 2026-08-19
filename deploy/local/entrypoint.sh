#!/bin/sh
set -eu

PROJECT_ID="${FIREBASE_PROJECT_ID:-demo-masonic-bar}"
DATA_DIR="${FIREBASE_DATA_DIR:-/firebase/data}"
mkdir -p "$DATA_DIR"

FLAGS="--project=${PROJECT_ID} --only=firestore,auth,ui --export-on-exit=${DATA_DIR}"
if [ -f "${DATA_DIR}/firebase-export-metadata.json" ]; then
  FLAGS="${FLAGS} --import=${DATA_DIR}"
fi

echo "Starting Firebase emulators (${PROJECT_ID})"
exec firebase emulators:start ${FLAGS}
