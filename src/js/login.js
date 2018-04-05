$(document).ready(function() {
  $("#emailField").select(); // Autoselect first input field on pageload

  var options = {
    cssEase: "cubic-bezier(0.5, 0.08, 0, 1)",
    appendArrows: $('.signup-navigation-container'),
    slidesToShow: 1,
    draggable: false,
    swipe: false,
    infinite: false
  };

  var userType = $(".signup-container").attr("data-usertype");

  if (userType === "user") {
    $('.organizer-signup .input-container').slick(options);
  } else {
    $('.vendor-signup .input-container').slick(options);
  }

  addSignupListener(options);
});

function addSignupListener(options) {
  $('.toggle-form').click(e => {
    let $self = $(e.currentTarget);

    $('.toggle-form').parent().removeClass('is-active');
    $self.parent().addClass('is-active');

    if ($self.hasClass('show-vendor')) {
      $('.vendor-signup').show().children().eq(0).slick(options);
      $('.organizer-signup').hide().children().eq(0).slick('unslick');
    } else {
      $('.vendor-signup').hide().children().eq(0).slick('unslick');
      $('.organizer-signup').show().children().eq(0).slick(options);
    }
  })
}