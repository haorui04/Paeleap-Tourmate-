"use client";
import {useEffect} from 'react';import {getSupabaseBrowserClient} from '../lib/client/supabase.js';
export default function RecoveryRouter(){useEffect(()=>{const client=getSupabaseBrowserClient();if(!client)return;const {data}=client.auth.onAuthStateChange(event=>{if(event==='PASSWORD_RECOVERY'){try{sessionStorage.setItem('tourmate-recovery','1');}catch{}if(location.pathname!=='/reset-password')location.replace('/reset-password');}});return()=>data.subscription.unsubscribe();},[]);return null;}
