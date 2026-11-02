// Live Hub Click-to-Call: basic authentication, adapted for the Azure Grand demo site.
// Upload to GitHub as  public/c2c/c2c-config.js  (next to click-to-call-widget.js).
(function () {
    // ---- 1. Fill in these three values ------------------------------------
    var USERNAME = 'REPLACE_USERNAME';     // 'Username' from the SIP connection's Incoming tab (Credentials)
    var PASSWORD = 'REPLACE_PASSWORD';     // 'Password' from the same tab
    var CALL_NUMBER = 'REPLACE_CALL_NUMBER'; // destination the widget dials (see notes)
    // -----------------------------------------------------------------------

    var slot = document.getElementById('c2c-slot') || document.body;
    var note = document.getElementById('c2c-note');

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia ||
        !navigator.mediaDevices.enumerateDevices
    ) {
        console.error('WebRTC not supported.');
        if (note) note.textContent = 'This browser can’t make web calls. Try Chrome, Edge or Safari, or call the front desk.';
        return;
    }

    // The hotel page already loads the main file. Only load it here if it isn't there yet.
    if (!window.customElements || !customElements.get('click-to-call-widget')) {
        if (!document.getElementById('clickToCallWidget')) {
            var clickToCallScript = document.createElement('script');
            clickToCallScript.src = '/c2c/click-to-call-widget.js';   // was './click-to-call-widget.js'
            clickToCallScript.id = 'clickToCallWidget';
            clickToCallScript.defer = true;
            document.head.appendChild(clickToCallScript);
        }
    }

    var config = {
        c2c_config: {
            caller: USERNAME,
            password: PASSWORD,
            callerPhone: '',
            call: CALL_NUMBER,
            dtmfKeypadEnabled: true,
            screenSharingEnabled: false,
            keepConnectionAfterCall: 0
        },
        c2c_serverConfig: {
            domain: 'pcbiripgmbju.sip1-region1.audiocodes.io',
            addresses: ['wss://pcbiripgmbju.sip1-region1.audiocodes.io']
        }
    };
    var form = { isValid: true };

    var clickToCallWidget = document.createElement('click-to-call-widget');
    clickToCallWidget.setAttribute('config', JSON.stringify(config));
    clickToCallWidget.setAttribute('form', JSON.stringify(form));

    if (note) note.remove();
    slot.appendChild(clickToCallWidget);   // was document.body.appendChild(...)
})();
