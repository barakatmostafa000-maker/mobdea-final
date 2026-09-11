import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("R20 core runtime and native tablet media are installed", () => {
  const main = read("src/main.jsx");
  assert.match(main, /r20-fix01-core-runtime\.css/);
  assert.match(main, /r20RuntimeCore\.js/);

  const runtime = read("src/services/r20RuntimeCore.js");
  assert.match(runtime, /R20_FIX01_CORE_RUNTIME_V1/);
  assert.match(runtime, /mobdea:r20-media-unlocked/);
  assert.match(runtime, /r20SpeakArabic/);
  assert.match(runtime, /tess304/);
  assert.match(runtime, /r20-return-control/);

  const css = read("src/styles/r20-fix01-core-runtime.css");
  assert.match(css, /R20_FIX01_CORE_RUNTIME_V1/);
  assert.match(css, /overflow-y:\s*auto\s*!important/);
  assert.match(css, /r20-online-floating-control/);
  assert.match(css, /r20-board-tools-control/);

  const activity = read(
    "android/app/src/main/java/com/mobdea/education/MainActivity.java",
  );
  assert.match(activity, /R20_FIX01_TABLET_MEDIA_WEBVIEW_V1/);
  assert.match(activity, /setMediaPlaybackRequiresUserGesture\(false\)/);
  assert.match(activity, /setDomStorageEnabled\(true\)/);
});

test("ClassMode Project12 dependency cannot precede relatedQuestions", () => {
  const source = read("src/pages/ClassMode.jsx");
  const related = source.indexOf("const relatedQuestions = useMemo");
  const project12 = source.indexOf("const [project12QuestionScope");
  if (related >= 0 && project12 >= 0) {
    assert.ok(
      related < project12,
      "relatedQuestions must initialize before Project12 state",
    );
  }
});
