# Match Image Snapshot
## saving reference snapshots
1. when creating a new test using `toMatchImageSnapshot` command, please make sure to commit the generated `test name #0.png` files and a duplicate file named `test name #1.png` to account for the retries
(this is due to `cypress-plugin-snapshots` not supporting cypress retries feature)
2. if you are using multiple `toMatchImageSnapshot` in a single test case, please pass a globally unique name to the command  
```
cy.get("#element1").toMatchImageSnapshot({name:"test name-element1"})
cy.get("#element2").toMatchImageSnapshot({name:"test name-element2"})
```
3. run cypress in docker and on your local machine to match the github-action environment
```
cd cypress && docker-compose up
```

## updating cypress snapshots

1. first checkout the previous snapshots
```
.
├── ...
├── cypress                   
│   ├── e2e         # End-to-end, integration tests
│   |   ├── __image_snapshots__      # refrence snapshots that cypress uses for comparison
|   |   |   ├── mw-view #0.png
|   |   |   ├── mw-view #1.png
|   |   |   └──...
|   |   └──...
│   └── ...         
└── ...

```
2. start test server `yarn dev:test`
3. run cypress in docker `cd cypress && docker-compose up`
4. the test should fail since you updated the app visually and you should see the resulting snapshots here
```
.
├── ...
├── cypress                   
│   ├── e2e        
│   |   ├── __image_snapshots__    
|   |   |   ├── mw-view #0.actual.png
|   |   |   ├── mw-view #0.diff.png
|   |   |   ├── mw-view #0.png
|   |   |   ├── mw-view #1.actual.png
|   |   |   ├── mw-view #1.diff.png
|   |   |   ├── mw-view #1.png
|   |   |   └──...
|   |   └──...
│   └── ...         
└── ...

```
5. review the changes,if approved replace `mw-view #1.png and mw-view #0.png` with `mw-view #0.actual.png`
or run `./scripts/update-cypress-snapshots.sh` to update all test snapshots