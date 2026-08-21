#!/bin/sh
set -eu

PROJECT_ID="${FIREBASE_PROJECT_ID:-demo-masonic-bar}"
DATA_DIR="${FIREBASE_DATA_DIR:-/firebase/data}"
# Export into a subdirectory. firebase-tools rmdir()s the export path first;
# that fails with EBUSY when the path is a Docker volume mount, so on-exit
# export never persisted and a container recreate rolled back to the last
# successful snapshot.
SNAPSHOT="${DATA_DIR}/snapshot"
mkdir -p "$DATA_DIR" "$SNAPSHOT"

FLAGS="--project=${PROJECT_ID} --only=firestore,auth,ui --export-on-exit=${SNAPSHOT}"
if [ -f "${SNAPSHOT}/firebase-export-metadata.json" ]; then
  FLAGS="${FLAGS} --import=${SNAPSHOT}"
elif [ -f "${DATA_DIR}/firebase-export-metadata.json" ]; then
  FLAGS="${FLAGS} --import=${DATA_DIR}"
fi

echo "Starting Firebase emulators (${PROJECT_ID})"
exec firebase emulators:start ${FLAGS}
