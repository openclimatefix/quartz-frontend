#!/usr/bin/env bash

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
cd $SCRIPT_DIR
cd ../cypress/e2e/__image_snapshots__/

allfiles=(*)
snapshotnames=(*)


#### get snapshotnames from allfiles

IFS='#'
for k in "${!allfiles[@]}"
  do
    file=(${snapshotnames[$k]})
    snapshotnames[$k]=${file[0]}
done
IFS=' '
####

### filter uniq snapshotnames
declare -A Aseen
uniqueFiles=()
for w in "${snapshotnames[@]}"; do
    [[ ${Aseen[$w]} ]] && continue
    uniqueFiles+=( "$w" )
    Aseen[$w]=x
done
####

### replace actual snapshot with refrence snapshot
for w in "${uniqueFiles[@]}"; do
    newfile="$w#0.actual.png"
    if [[ " ${allfiles[*]} " =~ "${newfile}" ]]; then
      echo "updating $w ..."
      cp -f "./$newfile" "./$w#0.png"
      cp -f "./$newfile" "./$w#1.png"
    fi

done
####

