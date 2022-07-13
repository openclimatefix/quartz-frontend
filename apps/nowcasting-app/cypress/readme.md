# Match Image Snapshot
## important notes
1. when create a new test using `toMatchImageSnapshot` command , please make sure to commit the generated `test name #0.png` files and a duplicate file named `test name #1.png` to account for the retries
(this is due to `cypress-plugin-snapshots` not supporting cypress retries feature)
2. if you are using multiple `toMatchImageSnapshot` in a single test case ,please pass a globaly unique name to the command  
```
cy.get("#element1").toMatchImageSnapshot({name:"test name-element1"})
cy.get("#element2").toMatchImageSnapshot({name:"test name-element2"})
```