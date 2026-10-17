$(document).ready(function () {
    $('.form_submit').submit(function(e){
        e.preventDefault();
        let frm = $(this);

        //loader work
        // let submitBtn = frm.find('input[type="submit"]');
        // submitBtn.prop('disabled', true);
        // submitBtn.val('Processing...');

        $('#submitBtn').prop('disabled', true).text('Processing...');
        //end

        let lnk = frm.attr('action');
        
        // $('#preloader, #loading').show();
        frm.find('.frm-err').remove();
        frm.find('.border-danger').removeClass('border-danger');
        frm.find('input, select, textarea').attr('readonly', true);
        frm.find('button').attr('disabled', true);

        $.ajax({
            url: lnk,
            type: 'post',
            data: new FormData(this),
            dataType: 'json',
            contentType: false,
            processData: false,
            cache: false,
            success: function(r){   
                $('#preloader, #loading').hide();

                // submitBtn.prop('disabled', false);
                // submitBtn.val('Get In Touch');

                $('#submitBtn').prop('disabled', false).text('Submit Inquiry');

                frm.find('input, select, textarea').attr('readonly', false);
                frm.find('button').attr('disabled', false);        
                if(r.success == true){
                    if(r.reload){location.reload();}
                    if(r.link){window.location.href = r.link;}
                    if(r.html){frm.html(r.html);}   


                }else{
                    // $.each(r.message, function(k,v){ 
                    //     if(v.length > 0){
                    //         if(r.e_position == 'after'){
                    //             frm.find('input[name='+k+'], select[name='+k+'], textarea[name='+k+']').after('<span class="frm-err">'+v+'</span>');
                    //         }else{
                    //             frm.find('input[name='+k+'], select[name='+k+'], textarea[name='+k+']').before('<span class="frm-err">'+v+'</span>');
                    //         }
                    //         frm.find('input[name='+k+'], select[name='+k+'], textarea[name='+k+']').focus().addClass('border-danger');
                    //     }
                    // });

                    let firstField = null;
                        $.each(r.message, function(k,v){
                            if(v.length > 0){
                                let field = frm.find('input[name="'+k+'"], select[name="'+k+'"], textarea[name="'+k+'"]');
                                if(r.e_position == 'after'){
                                    field.after('<span class="frm-err">'+v+'</span>');
                                }else{
                                    field.before('<span class="frm-err">'+v+'</span>');
                                }
                                field.addClass('border-danger');
                                if(firstField == null){
                                    firstField = field;
                                }
                            }
                        });

                        if(firstField){
                            if(typeof MyScroll !== 'undefined' && MyScroll){
                                MyScroll.scrollIntoView(firstField[0], {
                                    offsetTop: 120
                                });
                            }
                            firstField.focus();
                        }
                }
            }
        });
    });
 
    
    
});
 

 

function bsUrl(){
    let url = window.location.origin;
    if(url == 'http://localhost'){
        var pathArray = window.location.pathname.split( '/' );
        url = url+'/metalcraft/'+pathArray[2];
    }
    return url;
}




 