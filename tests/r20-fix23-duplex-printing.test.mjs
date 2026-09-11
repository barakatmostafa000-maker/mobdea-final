import assert from "node:assert/strict";
import test from "node:test";

const {
  R20_DUPLEX_PAGE,
  physicalBackSlotIndex,
  buildDuplexManifest,
} = await import(
  "../src/services/r20DuplexPrinting.js"
);

function cards(
  count,
) {
  return Array.from(
    {
      length:
        count,
    },
    (
      _,
      index,
    ) => ({
      cardId:
        `CARD-${index + 1}`,
      front: {
        side:
          "front",
      },
      back: {
        side:
          "back",
      },
    }),
  );
}

test("FIX23 A4 grid is exact 2x5 and holds ten cards", () => {
  assert.deepEqual(
    R20_DUPLEX_PAGE,
    {
      widthMm:
        210,
      heightMm:
        297,
      cardWidthMm:
        85.6,
      cardHeightMm:
        54,
      columns:
        2,
      rows:
        5,
      capacity:
        10,
    },
  );
});

test("FIX23 long-edge duplex mirrors columns, not rows", () => {
  const expected = [
    1, 0,
    3, 2,
    5, 4,
    7, 6,
    9, 8,
  ];

  assert.deepEqual(
    Array.from(
      {
        length:
          10,
      },
      (
        _,
        index,
      ) =>
        physicalBackSlotIndex(
          index,
          "long-edge",
        ),
    ),
    expected,
  );
});

test("FIX23 short-edge duplex mirrors rows, not columns", () => {
  const expected = [
    8, 9,
    6, 7,
    4, 5,
    2, 3,
    0, 1,
  ];

  assert.deepEqual(
    Array.from(
      {
        length:
          10,
      },
      (
        _,
        index,
      ) =>
        physicalBackSlotIndex(
          index,
          "short-edge",
        ),
    ),
    expected,
  );
});

test("FIX23 eleven cards create four separate physical A4 pages", () => {
  const manifest =
    buildDuplexManifest(
      cards(
        11,
      ),
      {
        flipEdge:
          "long-edge",
      },
    );

  assert.equal(
    manifest.sheetCount,
    2,
  );

  assert.equal(
    manifest.physicalPageCount,
    4,
  );

  assert.equal(
    manifest.sheets[0]
      .count,
    10,
  );

  assert.equal(
    manifest.sheets[1]
      .count,
    1,
  );
});

test("FIX23 every back stays physically behind its own front", () => {
  const manifest =
    buildDuplexManifest(
      cards(
        11,
      ),
      {
        flipEdge:
          "long-edge",
      },
    );

  for (
    const sheet of
    manifest.sheets
  ) {
    for (
      const frontSlot of
      sheet.frontSlots
    ) {
      if (!frontSlot) {
        continue;
      }

      const destination =
        physicalBackSlotIndex(
          frontSlot
            .slotIndex,
          "long-edge",
        );

      const backSlot =
        sheet.backSlots[
          destination
        ];

      assert.ok(
        backSlot,
      );

      assert.equal(
        backSlot.cardId,
        frontSlot.cardId,
      );

      assert.equal(
        backSlot.cardIndex,
        frontSlot.cardIndex,
      );
    }
  }
});

test("FIX23 partial long-edge sheet moves top-left back to top-right", () => {
  const manifest =
    buildDuplexManifest(
      cards(
        1,
      ),
      {
        flipEdge:
          "long-edge",
      },
    );

  assert.equal(
    manifest.sheets[0]
      .frontSlots[0]
      .cardId,
    "CARD-1",
  );

  assert.equal(
    manifest.sheets[0]
      .backSlots[1]
      .cardId,
    "CARD-1",
  );

  assert.equal(
    manifest.sheets[0]
      .backSlots[0],
    null,
  );
});

test("FIX23 rejects cards without both real sides", () => {
  assert.throws(
    () =>
      buildDuplexManifest([
        {
          cardId:
            "BROKEN",
          front: {},
        },
      ]),
    /front or back/,
  );
});
