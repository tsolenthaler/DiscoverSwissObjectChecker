export const API_BASE_URLS = {
  test: "https://api.discover.swiss/test/info/v2",
  prod: "https://api.discover.swiss/info/v2"
};

export const ENDPOINTS = [
  "accommodations",
  "civicStructures",
  "creativeWorks",
  "events",
  "foodEstablishments",
  "imageObjects",
  "localbusinesses",
  "lodgingbusinesses",
  "mediaObjects",
  "places",
  "products",
  "skiresorts",
  "tours",
  "transportationSystems",
  "videoObjects",
  "webcams"
];

export const PREFIX_TO_ENDPOINT = {
  acc: "accommodations",
  civ: "civicStructures",
  crw: "creativeWorks",
  cre: "creativeWorks",
  eve: "events",
  evt: "events",
  foo: "foodEstablishments",
  fed: "foodEstablishments",
  img: "imageObjects",
  loc: "localbusinesses",
  lob: "localbusinesses",
  log: "lodgingbusinesses",
  lod: "lodgingbusinesses",
  med: "mediaObjects",
  pla: "places",
  pro: "products",
  prd: "products",
  ski: "skiresorts",
  tou: "tours",
  tra: "transportationSystems",
  trs: "transportationSystems",
  vid: "videoObjects",
  web: "webcams"
};

export const DEFAULT_CONFIG = {
  id: "cfg_default_test",
  name: "Default TEST",
  environment: "test",
  baseUrl: API_BASE_URLS.test,
  project: "tso-test",
  language: "",
  lastUsedAt: new Date().toISOString()
};

export const STORAGE_KEY = "discoverSwissCheckData.configs";
export const ACTIVE_CONFIG_KEY = "discoverSwissCheckData.activeConfigId";
