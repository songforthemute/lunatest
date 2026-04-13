# Determinism

Given the same input scenario, LunaTest should always produce the same result.

Core mechanisms:

- fixed seed for `math.random`
- virtual clock for `os.time` / `os.date`
- blocking `io.*` / `os.execute`
- VM isolation per execution unit
