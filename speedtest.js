#!/usr/bin/env node
'use strict';

// Замер скорости скачивания: 10 последовательных запросов к одному адресу.
// Без зависимостей, нужен Node.js 18+ (встроенный fetch).

const REQUESTS = 10;
const TIMEOUT_MS = 60_000;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseUrl(arg) {
  if (!arg) fail('Использование: node speedtest.js <url>');
  let url;
  try {
    url = new URL(arg);
  } catch {
    fail(`Некорректный адрес: ${arg}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    fail('Поддерживаются только http:// и https://');
  }
  return url;
}

// Один запрос: ждём полного тела ответа и считаем байты.
async function download(url) {
  const start = process.hrtime.bigint();
  // cache: 'no-store' и заголовок Cache-Control — чтобы не мерить кэш.
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

  let bytes = 0;
  for await (const chunk of res.body) bytes += chunk.length;

  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  return { bytes, ms };
}

async function main() {
  const url = parseUrl(process.argv[2]);
  console.log(`Адрес: ${url.href}\nЗапросов: ${REQUESTS}\n`);

  let totalBytes = 0;
  let totalMs = 0;

  for (let i = 1; i <= REQUESTS; i++) {
    let r;
    try {
      r = await download(url);
    } catch (err) {
      fail(`Запрос ${i} не удался: ${err.cause?.message ?? err.message}`);
    }
    totalBytes += r.bytes;
    totalMs += r.ms;
    const mbps = (r.bytes * 8) / (r.ms / 1000) / 1e6;
    console.log(
      `#${String(i).padStart(2)}: ${(r.bytes / 1e6).toFixed(2)} МБ за ${r.ms.toFixed(0)} мс (${mbps.toFixed(2)} Мбит/с)`
    );
  }

  if (totalBytes === 0) fail('Скачано 0 байт — скорость посчитать нельзя.');

  const avgMs = totalMs / REQUESTS;
  // Общая скорость = весь объём / суммарное время запросов.
  const mbitPerSec = (totalBytes * 8) / (totalMs / 1000) / 1e6;

  console.log('\n--- Итого ---');
  console.log(`Среднее время запроса: ${avgMs.toFixed(0)} мс`);
  console.log(`Скачано всего: ${(totalBytes / 1e6).toFixed(2)} МБ (${totalBytes} байт)`);
  console.log(`Скорость скачивания: ${mbitPerSec.toFixed(2)} Мбит/с (${(mbitPerSec / 8).toFixed(2)} МБ/с)`);
}

main();
