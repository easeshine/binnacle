# Doors

A PR has a **Door**: one-way or two-way. A one-way PR is hard to take back once it is published or kept, so the Maintainer reads it with more care. A one-way PR has the label `one-way`.

A PR is **one-way** if it does one of these things:

- changes what an author may import;
- changes the dsh services or packages that binnacle names;
- moves a pin;
- changes a format that a person keeps, such as a theme or the profile;
- changes a release workflow;
- changes this list.

Every other PR is **two-way**. If the Spec and the Part give different Doors, the Door is one-way.

Before 1.0, every PR is two-way: nothing published is promised to stay, so each change can be taken back by the next. The list above says which PRs become one-way after it.
