## Code formatting
We use [Black](https://black.readthedocs.io/en/stable/) to format our Python code.  We use these changes to Black's default settings:
- `max-line-length = 100` (_why_ do we allow up to 100 characters per line, unlike a lot of Python code that limits lines to 80 characters?  For the same reason that [Linus Torvalds recently changed the Linux kernel coding guidelines to allow up to 100 characters per line](https://linux.slashdot.org/story/20/05/31/211211/linus-torvalds-argues-against-80-column-line-length-coding-style-as-linux-kernel-deprecates-it) :) )

### Docstrings
We use [Google-style docstrings](https://google.github.io/styleguide/pyguide.html#s3.8-comments-and-docstrings).

## Unittesting
In terms of requirements around unittesting etc, please see [our Pull Request template](https://github.com/openclimatefix/.github/blob/master/PULL_REQUEST_TEMPLATE.md) (which lists all the criteria we hope each pull request satisfies).

## Jupyter Notebooks
For now, we maintain the `.py` files, and try to ensure they're all internally consistent, but we don't promise to maintain all our notebooks!  (That might change if our code starts being used by lots of people!)

## Spelling
We use American English in our code (for example, so we use 'center' rather than 'centre').  This is true for variable namings and docstrings.

## Repository Template
If making a new OCF Repository, please try using our [template here](https://github.com/openclimatefix/ocf_template) which should help with boilerplate linting and setup. 

## TODO
- publish black config file
- find a good way to automatically check that docstrings comply with Google style
- Change to using `ruff` for most linting
- Repo template
