var noarr=
[
    'PLEASE??',
    'Ill give you a kiss!',
    'Ill give you a GIANT stuffie :D',
    'Ill give you a foot massage',
    'Lets watch movies together ;)',
    'Some Ramen Soup together sounds nice',
    '😭',
    'Imagine our (your) future cat!',
    'But youre so cute 🥺'
]

var i = 0;
var arrlen=noarr.length;
const nobtn=document.getElementById('nobtn');
const yesbtn=document.getElementById('yesbtn');
const gifimage=document.getElementById('gifimage');

function success()
{
    const successChange=document.getElementById('successChange');
    successChange.innerHTML=
    `<h1 style='text-align:center;padding-top: 200px;'>YAYY❤️❤️!!!</h1> <br> <p style='display: block; margin: 0 auto;width:700px'>Every single day I wake up and I'm happy to have been fortunate enough to meet you. <br /><br>
     
    You make my day and night bright, and always keep me on my toes, whether it be when you ask me CS 304 questions and I panic and try to learn
     while teaching you, or when you wear those black boots, which makes me literally have to tiptoe. <br /> <br>

     You have one of the thoughtful, and out-right amazing personalities I've ever met. Every day I fall in love
     with you all over again, from days when we decide to cook together, to times when we cuddle, to big occasions when you surpise me with a longboard :) <br > <br>
     I love seeing you laugh, I love it when you complain about your classes or your arm after volleyball, I love it when you say I smell good, I love it when you look at me with your super deep eyes to try to decipher what I'm thinking, only to find out that there's nothing going on back there. <br>
     <br>
     You're smart. <br />
     Beautiful. <br />
     Thoughtful. <br />
     An amazing writer. <br />
     Have an eye for aesthetic. <br/>
     And most of all, <br /> <br />
     <span style='font-size:30px;'>You're mine!</span> <br/> <br>

    Happy Valentine's Day, I love you! <br> <br> <br>
    PS. By the time you recieve this it should be midterms day for me. I would invite you to a nice restaurant, but I know that's not ideal for you,
    so instead, after my midterm let's order some delicious food online (anywhere you want) on me, where we can then can continue watching Arcane. Maybe I could
    watch you play some league :)<br> <br> <br>
    </p>`;
    gifimage.innerHTML=
    `<img src='michelle.jpg' width="400px" height="600px">`;
}

function failPile()
{
    if(i<arrlen-1){
        if(i==4){
            gifimage.innerHTML=
            `<img src='valentine-2.jpeg' width="470" height="380">`;
        }
        i++;
        showNoBtn();
        var currentSize=parseFloat(window.getComputedStyle(yesbtn).fontSize);
        var newSize=currentSize+30;
        yesbtn.style.fontSize=newSize+'px';
        }
    else{
        i=0;
        showNoBtn();
        var currentSize=parseFloat(window.getComputedStyle(yesbtn).fontSize);
        var newSize=currentSize+4;
        yesbtn.style.fontSize=newSize+'px';
    }
}

function showNoBtn()
{
    nobtn.innerHTML=noarr[i];
}

showNoBtn();
