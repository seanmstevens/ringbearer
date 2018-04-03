$(function () {
  if (!localStorage.getItem("logged-in")) {
    getSessionDetails();
  }

  addDismissNotificationListeners();
  addMobileMenuListener();
  addBlur();
  
  progressively.init();
});

function addBlur() {
  $('.vendor-card').on({
    mouseover: e => {
      let $self = $(e.currentTarget);
      $self.children('.vendor-card-image').addClass('in-focus');
      $self.children('.vendor-icon').addClass('slide-up');
      $self.children('.vendor-text').addClass('text-shown');
    },
    mouseleave: e => {
      let $self = $(e.currentTarget);
      $self.children('.vendor-card-image').removeClass('in-focus');
      $self.children('.vendor-icon').removeClass('slide-up');
      $self.children('.vendor-text').removeClass('text-shown');
    }
  });
}

function addMobileMenuListener() {
  // Get all "navbar-burger" elements
  var $navbarBurgers = Array.prototype.slice.call(document.querySelectorAll('.navbar-burger'), 0);

  // Check if there are any navbar burgers
  if ($navbarBurgers.length > 0) {

    // Add a click event on each of them
    $navbarBurgers.forEach(function ($el) {
      $el.addEventListener('click', function () {

        // Get the target from the "data-target" attribute
        var target = $el.dataset.target;
        var $target = document.getElementById(target);

        // Toggle the class on both the "navbar-burger" and the "navbar-menu"
        $el.classList.toggle('is-active');
        $target.classList.toggle('is-active');

      });
    });
  }
}

function getSessionDetails() {
  $.ajax({
    method: "GET",
    url: "/session",
    data: {
      "source": "ajax"
    }
  }).done(data => {
    localStorage.setItem("logged-in", true);
    console.log(data);
  });
}

function addDismissNotificationListeners() {
  $('.flash-dismiss').on('click', e => {
    $(e.currentTarget).parent().remove();
  });
}
