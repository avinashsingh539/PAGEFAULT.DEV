# Reference values

Hand-calculated values used by the tests and by `npm run demo`.

These are address-translation facts only. Textbook page-replacement fault counts
(FIFO / LRU / Optimal reference strings) belong to the replacement-algorithm phase
and are deliberately **not** listed here yet: inventing them now would bake numbers
into tests before the algorithm that produces them exists.

## Page size used everywhere today

```
pageSize = 4096 bytes = 0x1000
```

## Virtual address → page number + offset

```
pageNumber = floor(virtualAddress / pageSize)
offset     = virtualAddress mod  pageSize
```

| virtual address | hex | page number | offset | reasoning |
| --- | --- | --- | --- | --- |
| 0 | 0x0 | 0 | 0 | first byte of page 0 |
| 1 | 0x1 | 0 | 1 | second byte of page 0 |
| 4095 | 0xFFF | 0 | 4095 | last byte of page 0 |
| 4096 | 0x1000 | 1 | 0 | first byte of page 1 |
| 4097 | 0x1001 | 1 | 1 | second byte of page 1 |
| 12388 | 0x3064 | 3 | 100 | 3 × 4096 + 100 = 12288 + 100 |
| 16384 | 0x4000 | 4 | 0 | 4 × 4096 |
| 74565 | 0x12345 | 18 | 837 | 18 × 4096 + 837 = 73728 + 837 |
| 1048576 | 0x100000 | 256 | 0 | 256 × 4096 = 1 MiB |
| 4294967295 | 0xFFFFFFFF | 1048575 | 4095 | 1048575 × 4096 + 4095 |

Sanity invariant checked by the tests: `pageNumber * pageSize + offset === virtualAddress`.

## Example machine (`engine/presets.ts`)

```
pageSize   = 4096
frameCount = 16                      (physical RAM = 16 × 4096 = 65536 bytes)
process    = example-process, pid 1
```

Example page table:

| page | mapping | state |
| --- | --- | --- |
| 0 | frame 3 | present |
| 1 | frame 7 | present |
| 2 | frame 1 | present |
| 3 | - | NOT PRESENT (access faults) |

Because pages 0..3 are known to the page table, the process' reported virtual
address space is 4 × 4096 = 16384 bytes.

## Virtual → physical (successful translations)

```
physicalAddress = frameNumber * pageSize + offset
```

| virtual address | page | offset | frame | physical address | hex |
| --- | --- | --- | --- | --- | --- |
| 0 | 0 | 0 | 3 | 12288 | 0x3000 |
| 256 | 0 | 256 | 3 | 12544 | 0x3100 |
| 4096 | 1 | 0 | 7 | 28672 | 0x7000 |
| 8191 | 1 | 4095 | 7 | 32767 | 0x7FFF |
| 8192 | 2 | 0 | 1 | 4096 | 0x1000 |
| 8481 | 2 | 289 | 1 | 4385 | 0x1121 |

Spec-style example with page 18 mapped to frame 7 (used by the machine tests):

| virtual address | page | offset | frame | physical address |
| --- | --- | --- | --- | --- |
| 0x12345 (74565) | 18 | 837 | 7 | 7 × 4096 + 837 = 29509 |
| 73728 (0x12000) | 18 | 0 | 7 | 28672 (0x7000) |
| 77823 (0x12FFF) | 18 | 4095 | 7 | 32767 (0x7FFF) |

## Faulting accesses

| virtual address | page | offset | outcome |
| --- | --- | --- | --- |
| 12388 (0x3064) | 3 | 100 | `PAGE_FAULT` (page 3 is not resident) |
| 405504 (0x63000) | 99 | 0 | `PAGE_FAULT` (no page-table entry exists) |

A fault produces events up to and including `PAGE_FAULT`, and **no**
`PAGE_TABLE_HIT`, `FRAME_RESOLVED`, `PHYSICAL_ADDRESS_GENERATED` or `RAM_ACCESS`.

## Event sequences

Successful access (8 events, `sequence` 0..7):

```
CPU_MEMORY_ACCESS
VIRTUAL_ADDRESS_GENERATED
ADDRESS_SPLIT
PAGE_TABLE_LOOKUP
PAGE_TABLE_HIT
FRAME_RESOLVED
PHYSICAL_ADDRESS_GENERATED
RAM_ACCESS
```

Faulting access (5 events, `sequence` 0..4):

```
CPU_MEMORY_ACCESS
VIRTUAL_ADDRESS_GENERATED
ADDRESS_SPLIT
PAGE_TABLE_LOOKUP
PAGE_FAULT
```

## Rejected input

| input | error code |
| --- | --- |
| address `-1`, `-4096` | `INVALID_VIRTUAL_ADDRESS` |
| address `1.5`, `NaN`, `Infinity` | `INVALID_VIRTUAL_ADDRESS` |
| page size `0`, `-4096`, `1.5`, `NaN` | `INVALID_PAGE_SIZE` |
| frame `-1` | `INVALID_FRAME_NUMBER` |
| offset `>= pageSize` or `< 0` | `INVALID_OFFSET` |
| duplicate page entry, present page without frame, non-present page with frame | `INVALID_PAGE_TABLE` |
| page mapped to a frame beyond physical RAM | `INVALID_PAGE_TABLE` |
| frame count `0`, negative pid | `INVALID_MACHINE_CONFIG` |
| an action the machine does not know | `UNKNOWN_ACTION` |
