"use client";

import { useCallback, useEffect, useState } from "react";
import { createTrip, fetchRemoteMessages, fetchRemoteTrips, mergeRemoteTrips,
  restoreTripCollection, serializeTripCollection, tripStorageKey } from "../lib/client/trips.js";

export default function useTripHistory(identity, client) {
  const [collection, setCollection] = useState({ owner: null, trips: [], activeTripId: null });
  const [storageFailed, setStorageFailed] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);
  const [syncAttempt, setSyncAttempt] = useState(0);

  useEffect(() => {
    setStorageFailed(false);
    setSyncFailed(false);
    if (!identity) {
      setCollection({ owner: null, trips: [], activeTripId: null });
      return;
    }
    let raw = null;
    let legacy = null;
    try { raw = window.localStorage.getItem(tripStorageKey(identity)); } catch { /* Use session fallback. */ }
    try {
      raw ||= window.sessionStorage.getItem(tripStorageKey(identity));
      legacy = window.sessionStorage.getItem(`paeleap.chat.v1.${identity}`);
    } catch { /* Empty history still works without browser storage. */ }
    setCollection({ owner: identity, ...restoreTripCollection(raw, legacy) });
  }, [identity]);

  useEffect(() => {
    if (!identity || collection.owner !== identity) return;
    const serialized = serializeTripCollection(collection);
    let persistent = false;
    try { window.localStorage.setItem(tripStorageKey(identity), serialized); persistent = true; } catch { /* Report persistence failure. */ }
    try { window.sessionStorage.setItem(tripStorageKey(identity), serialized); } catch { /* Optional fallback. */ }
    setStorageFailed(!persistent);
  }, [collection, identity]);

  useEffect(() => {
    if (!identity || identity === "demo" || !client) return undefined;
    const controller = new AbortController();
    setSyncFailed(false);
    fetchRemoteTrips(client, controller.signal).then((rows) => {
      if (controller.signal.aborted) return;
      setCollection((current) => current.owner !== identity ? current : {
        ...current, trips: mergeRemoteTrips(current.trips, rows)
      });
    }).catch(() => { if (!controller.signal.aborted) setSyncFailed(true); });
    return () => controller.abort();
  }, [identity, client, syncAttempt]);

  const updateTrip = useCallback((id, update) => {
    setCollection((current) => current.owner !== identity ? current : {
      ...current, trips: current.trips.map((trip) => trip.id === id ?
        (typeof update === "function" ? update(trip) : { ...trip, ...update }) : trip)
    });
  }, [identity]);

  const activeTrip = collection.owner === identity ? collection.trips.find((trip) => trip.id === collection.activeTripId) : null;

  const loadMessages = useCallback((trip) => {
    if (!trip?.conversationId || !client || trip.loadingHistory) return;
    const controller = new AbortController();
    updateTrip(trip.id, { loadingHistory: true, historyError: false });
    fetchRemoteMessages(client, trip.conversationId, controller.signal).then((rows) => {
      updateTrip(trip.id, (current) => ({ ...current, loaded: true, loadingHistory: false, historyError: false,
        updatedAt: rows.at(-1)?.createdAt || current.updatedAt,
        messages: rows.map((row, index) => {
          const cached = current.messages[index];
          return cached?.role === row.role && cached?.content === row.content ? { ...cached, ...row } : row;
        }) }));
    }).catch(() => updateTrip(trip.id, { loadingHistory: false, historyError: true }));
  }, [client, updateTrip]);

  useEffect(() => {
    if (activeTrip && activeTrip.loaded === false) loadMessages(activeTrip);
  }, [activeTrip?.id, activeTrip?.loaded, loadMessages]);

  function newTrip() {
    const trip = createTrip();
    setCollection((current) => ({ owner: identity, trips: [trip, ...(current.owner === identity ? current.trips : [])], activeTripId: trip.id }));
    return trip;
  }

  function selectTrip(id) {
    setCollection((current) => current.owner !== identity || !current.trips.some((trip) => trip.id === id) ? current : { ...current, activeTripId: id });
  }

  return { trips: collection.owner === identity ? collection.trips : [], activeTrip, updateTrip, newTrip, selectTrip,
    ready: Boolean(identity && collection.owner === identity && activeTrip), storageFailed, syncFailed,
    retrySync: () => setSyncAttempt((attempt) => attempt + 1), retryMessages: () => loadMessages(activeTrip) };
}
