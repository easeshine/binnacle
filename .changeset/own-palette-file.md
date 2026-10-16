---
'@easeshine/binnacle': patch
---

A person writes their own colours in `palette.json`, in binnacle's profile: a Tone's colour or Style under `colors`, and a Hue's colour under `hues`. binnacle reads it at the start and at each save, and the person's colours win over every plugin's layer. A file with a mistake keeps the colours that binnacle drew, and the status line says what is wrong, in its new segment `status.palette`. An author reads the file's state from `binnacle.palette`, and a test gives the mount a profile folder with `profile`.
