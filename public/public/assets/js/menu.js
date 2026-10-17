const mainImage = document.getElementById("mainProductImage");
const imageBox = document.querySelector(".main-image");
const thumbs = document.querySelectorAll(".thumb");

let zoom = 2.2;

// Thumbnail hover => Image Change
thumbs.forEach((thumb)=>{

    const img = thumb.querySelector("img");

    thumb.addEventListener("mouseenter",function(){

        if(mainImage.src !== img.src){

            mainImage.classList.add("change");

            setTimeout(()=>{

                mainImage.src = img.src;

                mainImage.classList.remove("change");

            },120);

        }

        thumbs.forEach(item=>item.classList.remove("active"));

        thumb.classList.add("active");

    });

});



// Mouse Move Zoom
imageBox.addEventListener("mousemove",function(e){

    const rect=imageBox.getBoundingClientRect();

    const x=((e.clientX-rect.left)/rect.width)*100;

    const y=((e.clientY-rect.top)/rect.height)*100;

    mainImage.style.transformOrigin=x+"% "+y+"%";

    mainImage.style.transform="scale("+zoom+")";

});



// Mouse Leave
imageBox.addEventListener("mouseleave",function(){

    mainImage.style.transformOrigin="center center";

    mainImage.style.transform="scale(1)";

});