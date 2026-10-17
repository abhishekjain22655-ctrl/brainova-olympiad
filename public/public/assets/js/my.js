window.addEventListener("load", function () {

    const counters = document.querySelectorAll(".my-counter");

    const observer = new IntersectionObserver(function(entries){

        entries.forEach(function(entry){

            if(entry.isIntersecting){

                const el = entry.target;
                const target = parseInt(el.dataset.count);
                let current = 0;

                const duration = 2000;
                const step = Math.ceil(target / (duration / 16));

                function animate(){

                    current += step;

                    if(current >= target){
                        current = target;
                    }else{
                        requestAnimationFrame(animate);
                    }

                    el.textContent = current.toLocaleString("en-IN");
                }

                animate();
                observer.unobserve(el);

            }

        });

    }, {
        threshold: 0.4
    });

    counters.forEach(function(counter){
        observer.observe(counter);
    });

});



$(document).ready(function () {

    // Isotope Initialize
    var $grid = $('.gallery-grid').isotope({
        itemSelector: '.gallery-item',
        layoutMode: 'fitRows',
        percentPosition: true,
        transitionDuration: '0.5s'
    });

    // Filter Click
    $('.gallery-tabs').on('click', 'button', function () {

        $('.gallery-tabs button').removeClass('active');
        $(this).addClass('active');

        var filterValue = $(this).attr('data-filter');

        $grid.isotope({
            filter: filterValue
        });

    });

});