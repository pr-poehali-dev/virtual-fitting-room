// Изображения карт Ленорман.
// Ключ — номер карты (1..36), совпадает с позицией в CARD_NAMES + 1.
// Номер 0 — рубашка карты (back).
// Файлы лежат в S3-хранилище проекта.

import { CARD_NAMES } from './lenormand';

const BASE =
  'https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket';

// Соответствие "номер карты -> имя файла в хранилище"
export const CARD_IMAGE_BY_NUMBER: Record<number, string> = {
  0: `${BASE}/85cd2949-eca2-4aaf-9ca6-515907635509.png`,
  1: `${BASE}/31083132-20b3-4aa9-bed6-a012416cfdd5.png`,
  2: `${BASE}/39493f3a-6ed2-485a-9f29-65132102dc07.png`,
  3: `${BASE}/bdc39041-8f1c-409e-9df8-9d7a6e7f2880.png`,
  4: `${BASE}/95e9d9db-2535-4d70-be53-5cee0fdab023.png`,
  5: `${BASE}/dbd32029-5063-4dfc-bc16-e55c3d444496.png`,
  6: `${BASE}/6008f467-6dc3-458c-af43-6567b698273b.png`,
  7: `${BASE}/871a3de6-f198-4e45-80e9-c0286e35b83c.png`,
  8: `${BASE}/9b30d518-273e-43a1-9d52-60a9d7a4852f.png`,
  9: `${BASE}/420a3dd4-7743-4a65-ace7-3e5b82d338ea.png`,
  10: `${BASE}/7583aaa2-a073-45de-b8c9-2a81acd9dc7e.png`,
  11: `${BASE}/776080b8-bc8c-4357-b423-5b2f975bf9b6.png`,
  12: `${BASE}/d1c03b22-7fdd-4044-bea8-028e274c8298.png`,
  13: `${BASE}/a8e9b94b-bf15-4ae8-b4cb-5479f4bcbc6c.png`,
  14: `${BASE}/01f42ae7-7a5e-477e-977e-a2f5ae473de0.png`,
  15: `${BASE}/ca49b451-076c-41b3-b1df-975c5ddc3b7c.png`,
  16: `${BASE}/6b1a0f1e-b874-49ac-a6ab-b527dfa710e3.png`,
  17: `${BASE}/d80d923b-617d-4f4c-93a2-ab4d37634f82.png`,
  18: `${BASE}/eaa8d01f-3126-4e49-8a1e-af5ec97ee5cc.png`,
  19: `${BASE}/18f89367-397c-47f2-95d0-a734f48a5d32.png`,
  20: `${BASE}/a0d3e5e2-475a-4d8d-9c89-48ef30018212.png`,
  21: `${BASE}/62ed366d-57bf-4d38-857b-751fc0bddd30.png`,
  22: `${BASE}/a2fe87be-cfe4-4233-95e1-daff9d4f8d6e.png`,
  23: `${BASE}/097153aa-70fa-40fb-9180-79a494339535.png`,
  24: `${BASE}/72942cc3-0869-43db-b2cf-2db58b66e8b1.png`,
  25: `${BASE}/5236755e-abd5-4814-a2a5-aabc73c916d0.png`,
  26: `${BASE}/f233cbde-0f0c-41b4-99ea-ae1f4d6169b2.png`,
  27: `${BASE}/f1803c36-34cf-4fbc-a5dd-94bd9fc4e8c9.png`,
  28: `${BASE}/e185f095-7acc-4f59-8bd6-66fb6752f0c9.png`,
  29: `${BASE}/b9249c2d-6250-4d09-952f-038baf648678.png`,
  30: `${BASE}/e977423d-a3b9-4814-a518-d8d088896810.png`,
  31: `${BASE}/86eded61-3ebe-4253-aa18-d616c7809da3.png`,
  32: `${BASE}/e920430b-04c3-434c-88b2-4f7818128f00.png`,
  33: `${BASE}/f45f228f-e129-4abc-9961-269cc2fea103.png`,
  34: `${BASE}/9e9ac48d-a5a0-4334-8edf-8f2bab845f76.png`,
  35: `${BASE}/1d299acd-bd67-4b41-ba3f-fc81e074982b.png`,
  36: `${BASE}/bcdf4ecb-9b84-49fc-ad76-1e7a2bbffb4d.png`,
};

// URL рубашки карты (back)
export const CARD_BACK_IMAGE = CARD_IMAGE_BY_NUMBER[0];

// Картинка карты по её названию (например, "Клевер").
// Возвращает undefined, если название не найдено.
export const getCardImageByName = (name: string): string | undefined => {
  const idx = CARD_NAMES.indexOf(name);
  if (idx < 0) return undefined;
  return CARD_IMAGE_BY_NUMBER[idx + 1];
};
