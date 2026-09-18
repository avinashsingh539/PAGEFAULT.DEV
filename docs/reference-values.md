# Reference values

Hand-calculated values used by the tests and by `npm run demo`.

Everything here is a literal fact: address arithmetic, the example machine, and the
textbook page-replacement fault counts. None of it is produced by calling the engine
at test time - the tests assert these numbers against the engine, so a wrong
implementation cannot pass by agreeing with its own output.

# Part 1 - address translation

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

# Part 2 - page replacement

A reference-string exercise has three inputs: an algorithm, a list of **page
numbers** and a frame count. No addresses, no offsets, no page table. The harness
that answers it is `runReferenceString(algorithm, referenceString, frameCount)` in
`engine/replacement/referenceString.ts`.

## The time model

FIFO and LRU must know *when* something happened, and the engine takes that from the
**access index** - the position of the access in the reference string, counting from
`0`. It never reads a clock.

| field on a frame | meaning | used by |
| --- | --- | --- |
| `loadedAt` | access index at which the page entered this frame | FIFO only |
| `lastUsedAt` | access index of the most recent load or hit | LRU only |
| `useCount` | hits served since the page was loaded | reporting, not eviction |

A hit therefore **refreshes `lastUsedAt` and leaves `loadedAt` alone**. That one rule
is the whole difference between FIFO and LRU, and it is asserted directly by a test
that runs one string through both policies and finds identical frames with different
victims.

Optimal is the only policy that needs the future. It is given `futureUses` - the
references after the current access - and picks the page whose next use is farthest
away. A page that never appears again has no next use, which is the farthest
possible, so it is always the optimal victim.

**Tie-breaking:** when several frames are equally valid victims, the lowest frame
number wins. Without a fixed rule, "evict the oldest" would still be free to return a
different frame on each run, and no test could pin it down.

## The classic string (20 accesses), 3 frames

```
7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1
```

These are the published textbook counts (Silberschatz, *Operating System Concepts*),
and they are the numbers `npm run demo` prints:

| algorithm | faults | hits | evictions | final RAM |
| --- | --- | --- | --- | --- |
| FIFO | 15 | 5 | 12 | frames 0,1,2 = pages 7,0,1 |
| LRU | 12 | 8 | 9 | frames 0,1,2 = pages 1,0,7 |
| Optimal | 9 | 11 | 6 | frames 0,1,2 = pages 7,0,1 |

Invariants that hold for every row of this table: `faults + hits = 20`,
`loads = faults`, and `evictions = faults - 3` (the first three faults fill the three
empty frames, every later fault must evict something).

Ordering sanity check asserted by the tests for frame counts 1 through 6:
`Optimal <= LRU` and `Optimal <= FIFO` on faults, always.

## The 13-access string quoted in the Day 2 brief

```
7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2
```

This is exactly the first 13 accesses of the classic string above. It is kept as
`QUOTED_REFERENCE_STRING` because it was the string named in the brief - but the
brief's stated expectations (FIFO 15 faults, Optimal 9 faults) belong to the **full
20-access** string: 15 faults cannot happen in 13 accesses, because a fault needs an
access to fault on. The engine therefore reports:

| algorithm | faults | hits | evictions | final RAM | outcome per access |
| --- | --- | --- | --- | --- | --- |
| FIFO | 10 | 3 | 7 | pages 0,2,3 | `FFFFHFFFFFFHH` |
| LRU | 9 | 4 | 6 | pages 0,3,2 | `FFFFHFHFFFFHH` |
| Optimal | 7 | 6 | 4 | pages 2,0,3 | `FFFFHFHFHHFHH` |

`F` is a fault and `H` a hit, one character per access in order. The 15 / 12 / 9 row
above stays the authoritative published result; this table exists so the shorter
string's behaviour is pinned down too, instead of being left ambiguous.

Note that `QUOTED_REFERENCE_STRING` has 13 accesses and FIFO faults 10 times - more
than three quarters of the accesses. That is expected on a string this short and this
adversarial: with only 3 frames and 5 distinct pages, little can stay resident.

## Belady's anomaly (12 accesses)

```
1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5
```

More frames, more faults - for FIFO only, because FIFO is not a stack algorithm:

| algorithm | 3 frames (faults / hits) | 4 frames (faults / hits) | verdict |
| --- | --- | --- | --- |
| FIFO | 9 / 3 | 10 / 2 | **more** faults with more frames |
| LRU | 10 / 2 | 8 / 4 | fewer |
| Optimal | 7 / 5 | 6 / 6 | fewer |

The tests additionally check that for LRU and Optimal the fault count is
non-increasing as the frame count goes 1 -> 2 -> 3 -> 4 on this string.


## Events produced by one access

A hit is one event and no frame work:

```
PAGE_HIT
```

A fault that lands in a free frame:

```
PAGE_FAULT              freeFramesRemaining > 0
LOAD_PAGE
```

A fault that finds every frame occupied - the case that matters:

```
PAGE_FAULT              freeFramesRemaining === 0
REPLACEMENT_DECISION    algorithm, victim, and the structured evidence for it
EVICT_PAGE
LOAD_PAGE
```

## Worked example: the first eviction of the classic run

FIFO on the classic string, 3 frames. Accesses 0, 1 and 2 fill RAM with pages 7, 0
and 1, so access 3 (page 2) faults with every frame occupied. The run's events are
numbered from 0, and this access produces `sequence` 6, 7, 8 and 9:

| sequence | event | payload |
| --- | --- | --- |
| 6 | `PAGE_FAULT` | page 2, reason `PAGE_NOT_PRESENT`, `freeFramesRemaining` 0 |
| 7 | `REPLACEMENT_DECISION` | FIFO, victim page 7 in frame 0, rule `FIFO_EARLIEST_LOADED`, `victimLoadedAt` 0 |
| 8 | `EVICT_PAGE` | page 7, frame 0 |
| 9 | `LOAD_PAGE` | page 2, frame 0 |

After this access RAM is `[2, 0, 1]`. The decision's `evidence` is structured, never
a sentence: FIFO reports the victim's `loadedAt`, LRU its `lastUsedAt`, and Optimal
the victim's index inside `futureUses` (`null` meaning "never used again"). The demo
prints the same block as `[6] ... [9]` with the deciding numbers spelled out.

## Accounting invariants the tests enforce

| invariant | why it cannot be faked |
| --- | --- |
| `accesses = hits + faults` | every access is exactly one of the two |
| `loads = faults` | a fault always loads exactly one page |
| `evictions =` number of faults with `freeFramesRemaining === 0` | ties the counters back to the events |
| resident pages inside one snapshot are distinct | a page cannot occupy two frames |
| every `EVICT_PAGE` names a page that really was in that frame | the eviction is checked against the previous snapshot |
| a `HIT` entry has `evicted === null` and exactly one `PAGE_HIT` | no frame work happens on a hit |


## Rejected replacement input

| input | error code |
| --- | --- |
| algorithm `"CLOCK"`, `"fifo"`, `"Optimal"`, `""`, `"LFU"` (anything not exactly `FIFO` / `LRU` / `OPTIMAL`) | `INVALID_REPLACEMENT_ALGORITHM` |
| frame count `0`, `-1`, `1.5`, `NaN`, `Infinity`, `2^53` | `INVALID_FRAME_COUNT` |
| reference `-1`, `-4096`, `1.5`, `NaN`, `Infinity`, `"1"`, `null` | `INVALID_REFERENCE_STRING` |
| a sparse array (a hole reads back as `undefined`) | `INVALID_REFERENCE_STRING` |
| a reference string that is not an array at all (for example a string) | `INVALID_REFERENCE_STRING` |

Reference-string errors name the offending position, for example `reference 2 must
be a non-negative integer page number, received -1`. Sparse arrays are rejected on
purpose: `Array.prototype.every` skips holes, so a naive check would silently drop
an access instead of refusing it.

An unknown algorithm is rejected rather than defaulted: silently substituting FIFO
would make a typo look like a working simulation and publish the wrong fault count.

## Edge cases with hand-verifiable answers

| input | expected result |
| --- | --- |
| any algorithm, `[]`, 3 frames | 0 accesses, 0 faults, 3 free frames, no events, empty trace |
| any algorithm, `[1, 2, 1, 2]`, 1 frame | 4 faults, 0 hits, 3 evictions, page 2 resident |
| FIFO, `[5, 5, 5, 5]`, 2 frames | 1 fault, 3 hits, 0 evictions; frame 0 has `loadedAt` 0, `lastUsedAt` 3, `useCount` 3 |
| LRU, `[1, 2, 3]`, 5 frames | 3 faults, 0 evictions, two frames left free, no `REPLACEMENT_DECISION` at all |
| FIFO, `[1, 2, 3, 4]`, 3 frames | 4 faults, 1 eviction, RAM becomes pages 4, 2, 3 |
| OPTIMAL, `[0, 0, 0]`, 1 frame | 1 fault, 2 hits, events `PAGE_FAULT, LOAD_PAGE, PAGE_HIT, PAGE_HIT` |

Two things worth noting. In the `[1, 2, 3]` / 5-frame case the engine leaves frames
empty instead of evicting, because there is nothing it needs to evict - "full RAM" is
a precondition of replacement, not a goal. And in the `[5, 5, 5, 5]` case the page
number is an identity: repeated accesses to a resident page are hits, whatever the
page number is, up to the largest valid page number (`1048575` with a 4096-byte page).

