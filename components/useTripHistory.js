"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createTrip, fetchRemoteMessages, fetchRemoteTrips, mergeRemoteTrips,
  restoreTripCollection, serializeTripCollection, tripStorageKey, deleteRemoteTrip, removeTripFromCollection } from "../lib/client/trips.js";
import { DEFAULT_PERSONA_ID } from "../lib/client/personas.js";

export default function useTripHistory(identity, client, personaId = DEFAULT_PERSONA_ID) {
  const owner = identity ? `${identity}:${personaId}` : null;
  const [collection, setCollection] = useState({ owner: null, trips: [], activeTripId: null });
  const [storageFailed, setStorageFailed] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);
  const [syncAttempt, setSyncAttempt] = useState(0);
  const [deletingTripId, setDeletingTripId] = useState(null);
  const deletedIds = useRef(new Set());
  const channel = useRef(null);
  const currentOwner = useRef(owner);
  const collectionRef = useRef(collection);
  const skipBroadcastWrite = useRef(false);
  useEffect(() => { collectionRef.current = collection; }, [collection]);

  useEffect(() => {
    currentOwner.current = owner;
    deletedIds.current = new Set();
    skipBroadcastWrite.current = false;
    setDeletingTripId(null);
    if (!owner || typeof BroadcastChannel === "undefined") return;
    let connection;
    try { connection = new BroadcastChannel(`paeleap.history.${owner}`); } catch { return; }
    channel.current = connection;
    connection.onmessage = ({ data }) => {
      if (data?.type !== "deleted" || typeof data.tripId !== "string" ||
          (data.conversationId != null && !/^[0-9a-f-]{36}$/i.test(data.conversationId))) return;
      if (data.conversationId) deletedIds.current.add(data.conversationId);
      // The deleting tab writes the authoritative cache. A receiver must not
      // overwrite that cache with its older snapshot of unrelated drafts.
      if (collectionRef.current.owner === owner && collectionRef.current.trips.some(item =>
        item.id === data.tripId || (data.conversationId && item.conversationId === data.conversationId))) skipBroadcastWrite.current = true;
      setCollection(current => {
        if (current.owner !== owner) return current;
        const trip = current.trips.find(item => item.id === data.tripId || (data.conversationId && item.conversationId === data.conversationId));
        return trip ? removeTripFromCollection(current, trip.id, personaId) : current;
      });
    };
    return () => { connection.close(); if (channel.current === connection) channel.current = null; };
  }, [owner, personaId]);

  useEffect(() => {
    setStorageFailed(false);
    setSyncFailed(false);
    if (!identity) {
      setCollection({ owner: null, trips: [], activeTripId: null });
      return;
    }
    let raw = null;
    let legacy = null;
    try {
      raw = window.localStorage.getItem(tripStorageKey(identity, personaId));
      // The original application had only TourMate. Never migrate those chats
      // into a different museum, even if a visitor opens a copied link.
      if (!raw && personaId === DEFAULT_PERSONA_ID) raw = window.localStorage.getItem(`paeleap.trips.v2.${identity}`);
    } catch { /* Use session fallback. */ }
    try {
      raw ||= window.sessionStorage.getItem(tripStorageKey(identity, personaId));
      if (personaId === DEFAULT_PERSONA_ID) {
        raw ||= window.sessionStorage.getItem(`paeleap.trips.v2.${identity}`);
        legacy = window.sessionStorage.getItem(`paeleap.chat.v1.${identity}`);
      }
    } catch { /* Empty history still works without browser storage. */ }
    const restored = restoreTripCollection(raw, legacy, personaId);
    if (identity !== "demo") {
      restored.trips = restored.trips.map((trip) => ({ ...trip, messages: [], loaded: !trip.conversationId }));
    }
    setCollection({ owner, ...restored });
  }, [identity, owner, personaId]);

  useEffect(() => {
    if (!identity || collection.owner !== owner) return;
    if (skipBroadcastWrite.current) { skipBroadcastWrite.current = false; return; }
    const serialized = serializeTripCollection(collection, { includeMessages: identity === "demo" });
    let persistent = false;
    try { window.localStorage.setItem(tripStorageKey(identity, personaId), serialized); persistent = true; } catch { /* Report persistence failure. */ }
    try { window.sessionStorage.setItem(tripStorageKey(identity, personaId), serialized); } catch { /* Optional fallback. */ }
    // Retire old copies after v3 persistence, so deleted content is never
    // restored by the legacy migration fallback on a later visit.
    if (persistent && personaId === DEFAULT_PERSONA_ID) {
      for (const store of ["localStorage", "sessionStorage"]) {
        try { window[store].removeItem(`paeleap.trips.v2.${identity}`); window[store].removeItem(`paeleap.chat.v1.${identity}`); } catch { /* Optional legacy cleanup. */ }
      }
    }
    setStorageFailed(!persistent);
  }, [collection, identity, owner, personaId]);

  useEffect(() => {
    if (!identity || identity === "demo" || !client) return undefined;
    const controller = new AbortController();
    setSyncFailed(false);
    fetchRemoteTrips(client, controller.signal, personaId).then((rows) => {
      if (controller.signal.aborted) return;
      setCollection((current) => {
        if (current.owner !== owner) return current;
        const trips = mergeRemoteTrips(current.trips, rows.filter(row => !deletedIds.current.has(row.id)), personaId);
        if (!trips.length) trips.push(createTrip(personaId));
        return { ...current, trips, activeTripId: trips.some(trip => trip.id === current.activeTripId) ? current.activeTripId : trips[0].id };
      });
    }).catch(() => { if (!controller.signal.aborted) setSyncFailed(true); });
    return () => controller.abort();
  }, [identity, owner, personaId, client, syncAttempt]);

  const updateTrip = useCallback((id, update) => {
    setCollection((current) => current.owner !== owner ? current : {
      ...current, trips: current.trips.map((trip) => trip.id === id ?
        (typeof update === "function" ? update(trip) : { ...trip, ...update }) : trip)
    });
  }, [owner]);

  const activeTrip = collection.owner === owner ? collection.trips.find((trip) => trip.id === collection.activeTripId) : null;

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
    const trip = createTrip(personaId);
    setCollection((current) => ({ owner, trips: [trip, ...(current.owner === owner ? current.trips : [])], activeTripId: trip.id }));
    return trip;
  }

  function selectTrip(id) {
    setCollection((current) => current.owner !== owner || !current.trips.some((trip) => trip.id === id) ? current : { ...current, activeTripId: id });
  }

  async function deleteTrip(trip) {
    trip = collection.trips.find(item => item.id === trip?.id);
    if (!trip || trip.pending || deletingTripId || collection.owner !== owner) return false;
    setDeletingTripId(trip.id);
    try {
      if (identity !== "demo" && trip.conversationId) {
        if (!client) throw new Error("Session unavailable");
        await deleteRemoteTrip(client, trip.conversationId);
      }
      if (currentOwner.current !== owner) return false;
      if (trip.conversationId) deletedIds.current.add(trip.conversationId);
      setCollection(current => current.owner === owner ? removeTripFromCollection(current, trip.id, personaId) : current);
      channel.current?.postMessage({ type: "deleted", tripId: trip.id, conversationId: trip.conversationId });
      return true;
    } finally { if (currentOwner.current === owner) setDeletingTripId(null); }
  }

  return { trips: collection.owner === owner ? collection.trips : [], activeTrip, updateTrip, newTrip, selectTrip,
    deleteTrip, deletingTripId, ready: Boolean(identity && collection.owner === owner && activeTrip), storageFailed, syncFailed,
    retrySync: () => setSyncAttempt((attempt) => attempt + 1), retryMessages: () => loadMessages(activeTrip) };
}
