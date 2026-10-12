/* Ludo Royal - publicités & achats.
   1) WEB (Vercel) : Google AdSense / "AdSense for Games" (adBreak) -> renseigner ADS.adsenseClient.
   2) APPS (Android/iOS via Capacitor) : AdMob via @capacitor-community/admob -> renseigner ADS.admob.
   Tant que rien n'est renseigné, des espaces publicitaires de démonstration s'affichent (aucun revenu).
*/
const ADS = {
  adsenseClient: '',            // ex: 'ca-pub-1234567890123456'
  bannerSlot: '',               // ex: '1234567890' (bloc d'annonces display)
  interstitialEvery: 3,         // une pub plein écran toutes les N parties
  rewardedGems: 3,              // diamants offerts pour une vidéo récompensée
  admob: {                      // ID de TEST Google par défaut : remplacez par vos vrais ID avant publication
    banner: 'ca-app-pub-3940256099942544/6300978111',
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
    rewarded: 'ca-app-pub-3940256099942544/5224354917',
  },
  // Liens de paiement (Stripe Payment Link, PayPal.me...) pour acheter des diamants SUR LE WEB uniquement.
  payLinks: { gems50: '', gems150: '' },
};

const Ads = (() => {
  const native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const AdMob = native ? window.Capacitor.Plugins.AdMob : null;
  let adsenseLoaded = false;

  function loadAdsense() {
    if (adsenseLoaded || !ADS.adsenseClient || native) return;
    adsenseLoaded = true;
    const s = document.createElement('script');
    s.async = true; s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + ADS.adsenseClient;
    document.head.appendChild(s);
    window.adsbygoogle = window.adsbygoogle || [];
    window.adBreak = window.adConfig = function (o) { window.adsbygoogle.push(o); };
    window.adConfig({ preloadAdBreaks: 'on', sound: 'on' });
  }

  async function init() {
    if (AdMob) { try { await AdMob.initialize({}); } catch (e) { console.warn(e); } }
    loadAdsense();
  }

  function banner(el) {
    if (AdMob) { try { AdMob.showBanner({ adId: ADS.admob.banner, position: 'BOTTOM_CENTER', margin: 0, adSize: 'ADAPTIVE_BANNER' }); } catch (e) {} el.style.display = 'none'; return; }
    if (ADS.adsenseClient && ADS.bannerSlot) {
      el.innerHTML = '<ins class="adsbygoogle" style="display:block;width:100%;height:50px" data-ad-client="' + ADS.adsenseClient + '" data-ad-slot="' + ADS.bannerSlot + '"></ins>';
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
      return;
    }
    el.innerHTML = '<div class="adph">Espace publicitaire (bannière)</div>';
  }

  function placeholder(title, seconds, done) {
    const m = document.createElement('div');
    m.className = 'modal show';
    m.innerHTML = '<div class="card center"><h3>' + title + '</h3><div class="adbox">Publicité de démonstration</div><button class="btn" disabled>Patientez <b>' + seconds + '</b>s</button></div>';
    document.body.appendChild(m);
    const b = m.querySelector('button'); let s = seconds;
    const iv = setInterval(() => {
      s--; if (s > 0) b.querySelector('b').textContent = s;
      else { clearInterval(iv); b.disabled = false; b.textContent = 'Continuer'; b.onclick = () => { m.remove(); done(true); }; }
    }, 1000);
  }

  async function interstitial(done) {
    if (AdMob) {
      try { await AdMob.prepareInterstitial({ adId: ADS.admob.interstitial }); await AdMob.showInterstitial(); } catch (e) { console.warn(e); }
      return done();
    }
    if (ADS.adsenseClient && window.adBreak) {
      let called = false; const fin = () => { if (!called) { called = true; done(); } };
      window.adBreak({ type: 'next', name: 'entre-parties', adBreakDone: fin }); setTimeout(fin, 4000); return;
    }
    placeholder('Publicité', 3, () => done());
  }

  async function rewarded(onReward) {
    if (AdMob) {
      try {
        await AdMob.prepareRewardVideoAd({ adId: ADS.admob.rewarded });
        const r = await AdMob.showRewardVideoAd(); if (r) onReward();
      } catch (e) { console.warn(e); }
      return;
    }
    if (ADS.adsenseClient && window.adBreak) {
      window.adBreak({ type: 'reward', name: 'diamants-gratuits', beforeReward: show => show(), adViewed: onReward, adDismissed() {}, adBreakDone() {} });
      return;
    }
    placeholder('Vidéo récompensée', 5, ok => ok && onReward());
  }

  return { init, banner, interstitial, rewarded };
})();
