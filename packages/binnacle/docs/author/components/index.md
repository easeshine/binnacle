# Components

A component is a piece that binnacle's own features are built from, and yours can be. Each one fills the Place by its `name`, which you put in a Layout. Its Looks are `<name>.<piece>`, then `<component>.<piece>`, and its actions `<name>.<verb>`, of the kind `<component>.<verb>`. It gives back `{ handle }`, the Handle of its Part. `handle.dispose()` also takes away what else the component registered.
