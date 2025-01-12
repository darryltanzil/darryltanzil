// Particle.js initialization
particlesJS.load('particles-js', 'particles.json', function () {
    console.log('callback - particles.js config loaded');
});

// Add loaded class to body when window loads
window.onload = function () {
    window.scroll({
        top: 0,
        left: 0,
        behavior: 'smooth'
    });

    document.body.className += " loaded";

    // Initialize typewriter effect after delay
    var delayInMilliseconds = 1000;
    setTimeout(function () {
        var elements = document.getElementsByClassName('typewrite');
        for (var i = 0; i < elements.length; i++) {
            var toRotate = elements[i].getAttribute('data-type');
            var period = elements[i].getAttribute('data-period');
            if (toRotate) {
                new TxtType(elements[i], JSON.parse(toRotate), period);
            }
        }
        var css = document.createElement("style");
        css.type = "text/css";
        document.body.appendChild(css);
    }, delayInMilliseconds);
};

// Typewriter effect
var TxtType = function (el, toRotate, period) {
    this.toRotate = toRotate;
    this.el = el;
    this.loopNum = 0;
    this.period = parseInt(period, 10) || 2000;
    this.txt = '';
    this.tick();
    this.isDeleting = false;
};

TxtType.prototype.tick = function () {
    var i = this.loopNum % this.toRotate.length;
    var fullTxt = this.toRotate[i];

    if (this.isDeleting) {
        this.txt = fullTxt.substring(0, this.txt.length - 1);
    } else {
        this.txt = fullTxt.substring(0, this.txt.length + 1);
    }

    this.el.innerHTML = '<span class="wrap">' + this.txt + '</span>';

    var that = this;
    var delta = 100 - Math.random() * 100;

    if (this.isDeleting) {
        delta /= 2;
    }

    if (!this.isDeleting && this.txt === fullTxt) {
        delta = this.period;
        this.isDeleting = true;
    } else if (this.isDeleting && this.txt === '') {
        this.isDeleting = false;
        this.loopNum++;
        delta = 500;
    }

    setTimeout(function () {
        that.tick();
    }, delta);
};

// Hover message functionality
document.querySelectorAll('.hover-item').forEach(item => {
    item.addEventListener('mouseenter', event => {
        const messageBox = document.getElementById('message-box');
        const message = event.target.getAttribute('data-message');
        messageBox.textContent = message;
        messageBox.style.display = 'block';
    });

    item.addEventListener('mouseleave', () => {
        const messageBox = document.getElementById('message-box');
        messageBox.style.display = 'none';
    });
});

// Google Analytics
window.dataLayer = window.dataLayer || [];
function gtag() {
    dataLayer.push(arguments);
}
gtag('js', new Date());
gtag('config', 'G-M9MBTPKTNB'); 