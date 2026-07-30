import { APP_VERSION, APP_VERSION_CODE, DATA_SCHEMA_VERSION, RELEASE_CHANNEL, RELEASE_TAG } from './version';

export const release = Object.freeze({
  appVersion: APP_VERSION,
  versionCode: APP_VERSION_CODE,
  dataSchemaVersion: DATA_SCHEMA_VERSION,
  releaseChannel: RELEASE_CHANNEL,
  releaseTag: RELEASE_TAG,
  displayVersion: `V${APP_VERSION}`,
  footerLabel: `V${APP_VERSION} • ${RELEASE_TAG}`,
  manifestPath: 'update.manifest.json',
  appName: 'المُبدع',
  packageName: 'com.mobdea.education',
});
