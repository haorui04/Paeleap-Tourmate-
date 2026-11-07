'use client';

import { useEffect, useState } from 'react';
import { exhibits, reportLabels } from '../lib/museum-guide.js';

export default function MuseumReports({ client, language }) {
  const [result, setResult] = useState(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const zh = language === 'zh';
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const { data } = await client.auth.getSession();
      if (!data.session) throw Error('Authentication required');
      const response = await fetch('/api/museum/reports', {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])
      });
      if (!response.ok) throw Error('Reports unavailable');
      const reports = await response.json();
      if (!controller.signal.aborted) setResult(reports);
    }
    load().catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [client, attempt]);

  const date = new Intl.DateTimeFormat(zh ? 'zh-CN' : 'en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });
  return <section className="admin-card">
    <h2>{zh ? '展品反馈' : 'Exhibit feedback'}</h2>
    <p>{zh ? '近七个 UTC 日期内收到的分类反馈。' : 'Structured reports from the last seven UTC dates.'}</p>
    {failed && <p role="alert">{zh ? '暂时无法读取反馈。' : 'Reports are temporarily unavailable.'} <button type="button" onClick={() => { setFailed(false); setAttempt(attempt + 1); }}>{zh ? '重试' : 'Retry'}</button></p>}
    {!failed && !result && <p role="status">{zh ? '正在读取…' : 'Loading reports…'}</p>}
    {result && !result.reports.length && <p>{zh ? '暂无反馈。' : 'No reports received.'}</p>}
    {result?.limited && <p>{zh ? '每日最多显示最新 100 条。' : 'Shows up to the 100 most recent reports per day.'}</p>}
    {result?.reports.length > 0 && <ul>{result.reports.map(({ artifactId, reason, receivedAt }, index) => <li key={`${artifactId}-${reason}-${receivedAt}-${index}`}>
      <strong>{exhibits.find(exhibit => exhibit.id === artifactId).name[language]}</strong> · {reportLabels[reason][language]} · <time dateTime={receivedAt}>{date.format(new Date(receivedAt))} UTC</time>
    </li>)}</ul>}
  </section>;
}
