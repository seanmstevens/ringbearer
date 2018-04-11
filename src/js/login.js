const options = {
  cssEase: "cubic-bezier(0.5, 0.08, 0, 1)",
  appendArrows: $('.signup-navigation-container'),
  nextArrow: `<button type="button" class="slick-next has-text-primary">Next</button>`,
  prevArrow: `<button type="button" class="slick-prev has-text-primary">Previous</button>`,
  accessibility: true,
  slidesToShow: 1,
  draggable: false,
  swipe: false,
  infinite: false
};

$(function() {
  var userType = $(".signup-container").attr("data-usertype");

  $('.vendor-signup .input-container').slick(options);

  // addSignupListener(options);
  addFormValidationListeners();
  addNextSlideListeners();
});

function addSignupListener(options) {
  $('.toggle-form').click(e => {
    let $self = $(e.currentTarget);

    $('.toggle-form').parent().removeClass('is-active');
    $self.parent().addClass('is-active');

    if ($self.hasClass('show-vendor')) {
      $('.organizer-signup').hide().children().eq(0).slick('unslick');
      $('.vendor-signup').show().children().eq(0).slick(options);
    } else {
      $('.vendor-signup').hide().children().eq(0).slick('unslick');
      $('.organizer-signup').show().children().eq(0).slick(options);
    }
  });
}

(function($) {
  $.fn.resetValidationIndicators = function() {
    var _ = this;
    if (_.attr("data-validated") == "false") {
      _.removeClass("is-success").addClass("is-danger");
      _.siblings(".icon.is-right").remove();
    } else {
      _.removeClass("is-danger").addClass("is-success");
      _.parent().addClass("has-icons-right").append(
        `<span class="icon is-right has-text-success">
          <i class="mdi mdi-check"></i>
        </span>`
      );
      _.siblings(".error-msgs-wrapper").empty();
    }

    return _;
  };

  $.fn.validate = function() {
    var _ = this;
    _.attr("data-validated", true);
    return _;
  };

  $.fn.unvalidate = function() {
    var _ = this;
    _.attr("data-validated", false);
    return _;
  }

  $.fn.submit = function() {
    if (getCurrentSlide() !== 3) {
      return false;
    }
  }
})(jQuery);

function addSliderListener() {
  $(".slider").on('input', function(event) {
    $(this).siblings('output').text(`\$${event.target.value}.00/hr`);
  });
}

function getCurrentSlide() {
  let $form = $("form.slick-initialized");
  return $form.slick('slickCurrentSlide');
}

function getCurrentlyViewedInputs() {
  let currentSlide = getCurrentSlide();
  return $(`fieldset[data-slick-index=${currentSlide}]`).find("input, select");
}

function addNextSlideListeners() { 
  let $form = $("form.slick-initialized");

  $(document).on({
    'beforeChange': function(event, slick, currentSlide, nextSlide) {
      $(".current-status").css("width", nextSlide * 33.3 + "%"); // Displaying progress on top bar

      // Making next step segment active
      if (nextSlide < currentSlide) {
        $(`.steps-segment[data-slide=${currentSlide}]`).children().eq(0).addClass("is-hollow");
      }

      $(`.steps-segment[data-slide=${currentSlide}]`).removeClass("is-active");
      $(`.steps-segment[data-slide=${nextSlide}]`).addClass("is-active").children().eq(0).removeClass("is-hollow");

      if (nextSlide === 2 && $("fieldset[data-slide-index=3]").length === 0) {
        addNextSlide();
      }
  
      if (nextSlide === 3) {
        addSignUp();
      } else {
        removeSignUp();
      }
    }, 'afterChange': function(event, slick, currentSlide) {  
      console.log("currentSlide: " + currentSlide);
      initializeTabIndexes();
    }
  }, $form);
}

function addNextSlide() {
  const currentSlide = getCurrentSlide();
  const $form = $('form.slick-initialized');
  const slideMap = {
    0: `<fieldset data-validated="false">
          <div class="field">
            <label class="label">Name</label>
            <p class="help has-text-grey">Enter your full name.</p>
            <div class="control has-icons-left">
              <input class="input" type="text" data-touched="false" placeholder="Jane Q. Example" tabindex=-1 name="name">
              <span class="icon is-left">
                <i class="mdi mdi-account-circle"></i>
              </span>
              <div class="error-msgs-wrapper">
              </div>
            </div>
          </div>
          <div class="field">
            <label class="label">Business Name</label>
            <p class="help has-text-grey">Enter the name of your business.</p>
            <div class="control has-icons-left">
              <input class="input" type="text" data-touched="false" placeholder="Coolbusiness, LLC" tabindex=-1 name="business">
              <span class="icon is-left">
                <i class="mdi mdi-account-card-details"></i>
              </span>
              <div class="error-msgs-wrapper">
              </div>
            </div>
          </div>
        </fieldset>`,
    1: `<fieldset data-validated="false">
          <div class="field">
            <label class="label">Email</label>
            <p class="help has-text-grey">Enter your email below.</p>
            <div class="control has-icons-left">
              <input class="input" type="text" data-touched="false" placeholder="Email" tabindex=-1 name="email">
              <span class="icon is-left">
                <i class="mdi mdi-email-outline"></i>
              </span>
              <div class="error-msgs-wrapper">
              </div>
            </div>
          </div>
          <div class="field">
            <label class="label">Password</label>
            <p class="help has-text-grey">Enter a password longer than 8 characters below.</p>
            <div class="control has-icons-left">
              <input class="input"
                type="password" data-touched="false" placeholder="Password" tabindex=-1 name="password">
              <span class="icon is-left">
                <i class="mdi mdi-lock-outline"></i>
              </span>
              <div class="error-msgs-wrapper">
              </div>
            </div>
          </div>
          <div class="field">
            <p class="help has-text-grey">Re-enter your password below.</p>
            <div class="control has-icons-left">
              <input class="input"
                type="password" data-touched="false" placeholder="Verify Password" tabindex=-1 name="verify">
              <span class="icon is-left">
                <i class="mdi mdi-checkbox-marked-circle-outline"></i>
              </span>
              <div class="error-msgs-wrapper">
              </div>
            </div>
          </div>
        </fieldset>`,
    2: `<fieldset data-validated="false">
          <div class="field">
            <label class="label">Vendor Type</label>
            <p class="help has-text-grey">Select the type of vendor that best fits you below.</p>
            <div class="control has-icons-left">
              <div class="select is-fullwidth">
                <select name="vendortype" data-touched="false" tabindex=-1>
                ${generateTypeOptions()}
                </select>
              </div>
              <span class="icon is-left">
                <i class="mdi mdi-camera"></i>
              </span>
              <div class="error-msgs-wrapper">
              </div>
            </div>
          </div>
          <div class="field">
            <label class="label">Rate</label>
            <p class="help has-text-grey">Choose your standard rate from the slider below.</p>
            <div class="control">
              <input class="slider is-fullwidth is-success has-output" id="rateSlider" tabindex=-1 name="price" data-touched="false" step="1" min="0" max="1000" 
                value="500" type="range">
              <output for="rateSlider">$500.00/hr</output>
            </div>
          </div>
        </fieldset>`,
    3: `<fieldset data-validated="false">
          <div class="field">
            <label class="label">Address</label>
            <p class="help has-text-grey">Fill out your address information below.</p>
            <div class="control has-icons-left is-expanded">
              <input class="input" type="text" data-touched="false" placeholder="Street Address" tabindex=-1 name="address">
              <span class="icon is-left">
                <i class="mdi mdi-home"></i>
              </span>
              <div class="error-msgs-wrapper">
              </div>
            </div>
          </div>
          <div class="field">
            <div class="control has-icons-left is-expanded">
              <input class="input" type="text" data-touched="false" placeholder="City" tabindex=-1 name="city">
              <span class="icon is-left">
                <i class="mdi mdi-google-maps"></i>
              </span>
              <div class="error-msgs-wrapper">
              </div>
            </div>
          </div>
          <div class="field is-grouped state-zip-group">
            <div class="control has-icons-left is-expanded">
              <span class="select is-fullwidth">
                <select name="state" data-touched="false" tabindex=-1>
                ${generateStateOptions()}
                </select>
              </span>
              <span class="icon is-left">
                <i class="mdi mdi-map-marker"></i>
              </span>
            </div>
            <div class="control has-icons-left zip-input">
              <input class="input" type="text" data-touched="false" placeholder="Zipcode" tabindex=-1 name="zipcode" maxlength="5">
              <span class="icon is-left">
                <i class="mdi mdi-map-marker"></i>
              </span>
              <div class="error-msgs-wrapper">
              </div>
            </div>
          </div>
        </fieldset>`
  };

  $form.slick('slickAdd', slideMap[currentSlide + 1]);

  console.log(currentSlide === 1 && $("fieldset[data-slick-index=3]").length === 0);

  if (currentSlide === 1 && $("fieldset[data-slick-index=3]").length === 0) {
    $form.slick('slickAdd', slideMap[3]);
  }

  addSliderListener();

  function generateTypeOptions() {
    const typelist = [
      ["venue", "Venue"], 
      ["photographer", "Photographer"], 
      ["videographer", "Videographer"],
      ["caterer", "Caterer"],
      ["music", "Band/DJ"],
      ["cosmetics", "Hair/Makeup Artist"],
      ["tailor", "Tailor"]
    ];

    return typelist.map((value, index) => {
      return `<option value="${value[0]}">${value[1]}</option>`;
    });
  }

  function generateStateOptions() {
    const statelist = [
      "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DC", "DE", "FL", "GA", 
      "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", 
      "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", 
      "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", 
      "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
    ];

    return statelist.map((value, index) => {
      return `<option value="${value}">${value}</option>`;
    });
  }
}

function initializeTabIndexes() {
  let inputs = getCurrentlyViewedInputs();

  for (let element of inputs) {
    $(element).attr("tabindex", 0);
  }
}

function addFormValidationListeners() {
  let inputs = getCurrentlyViewedInputs();
  let touchedStatus;
  let errors = {};

  console.log("listeners added");

  $("form").on('change', '.input', e => {
    const $self = $(e.currentTarget);
    const $form = $self.parents("fieldset");
    const input = $self.val();
    const name = $self.attr("name");
    var errormsg;

    $self.attr("data-touched", true);

    if (name == "email") {
      let emailRegExp = new RegExp(/(^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$)/);

      if (!emailRegExp.test(input)) {
        if (!errors[name]) {
          errormsg = "Must be a valid email.";
          errors[name] = errormsg;
          $self.unvalidate();
          displayError($self, errormsg);
        }
      } else {
        delete errors[name];
        $self.validate();
      }
    } else if (name == "password") { // Password field verification
      let passwordRegExp = new RegExp(/(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}/);

      if (!passwordRegExp.test(input)) {
        if (!errors[name]) {
          errormsg = "Password must be at least 8 characters, and must contain at least one number, uppercase letter and lowercase letter.";
          errors[name] = errormsg;
          $self.unvalidate();
          displayError($self, errormsg);
        }
      } else {
        delete errors[name];
        $self.validate();
      }
    } else if (name == "verify") { // Password verification check
      let password = $("input[name='password']").val(); // There are two password fields (one on the user form and one on the vendor form) -- will need to change at some point

      if (input !== password) {
        if (!errors[name]) {
          errormsg = "Passwords do not match.";
          errors[name] = errormsg;
          $self.unvalidate();
          displayError($self, errormsg);
        }
      } else {
          delete errors[name];
          $self.validate();
      }
    } else { // Verification for non-specific input fields
      if (input == "" && !errors[name]) {
        errormsg = "This field cannot be left blank.";
        errors[name] = errormsg;
        $self.unvalidate();
        displayError($self, errormsg);
      } else if (input !== "" && errors[name]) {
        delete errors[name];
        $self.validate();
      }
    }

    $self.resetValidationIndicators();
  
    touchedStatus = getTouchedStatus(inputs);
    console.log(inputs);
    console.log("All inputs touched: " + touchedStatus);

    if (Object.keys(errors).length < 1 && touchedStatus === true) {
      $form.validate();

      if (isNavHidden()) {
        $(".signup-navigation-container").fadeIn("fast").attr("data-hidden", false);
      }

      if ($form.next("fieldset").length === 0 && getCurrentSlide() !== 3) { // Check to see if next slide already exists
        addNextSlide();
      }

      enableForwardNavigation();
    } else if (Object.keys(errors).length > 0) {
      $form.unvalidate();

      if ($form.next("fieldset").length > 0) {
        disableForwardNavigation();
      }
    }
  });
}

function comparePasswords(pass1, pass2) {
  return pass1 === pass2;
}


function getTouchedStatus(inputs) {
  for (let element of inputs) {
    if ($(element).attr("data-touched") == "false") {
      return false;
    }
  }
  
  return true;
}

function disableForwardNavigation() {
  $(".slick-next").addClass("slick-disabled");
}

function enableForwardNavigation() {
  $(".slick-next").removeClass("slick-disabled");
}

function isNavHidden() {
  return $(".signup-navigation-container").attr("data-hidden");
}

function addSignUp() {
  const signUpButton = `<button type="submit" name="vendor_signup" class="slick-arrow slick-signup has-text-primary" style="display:none">Sign Up</button>`;

  $(".signup-navigation-container").append(signUpButton);
  $(".slick-signup").fadeIn(180);
}

function removeSignUp() {
  const signUpButton = $(".slick-signup");
  signUpButton.fadeOut(180).remove();
}

function displayError(self, error) {
  if (!self instanceof jQuery) {
    self = $(self);
  }

  self.addClass("is-danger");
  self.siblings(".error-msgs-wrapper").append(
    buildError(error)
  );
}

function buildError(error) {
  return (
    `<p class="help is-danger">
      <i class="mdi mdi-alert-circle"></i>
      ${error}
    </p>`
  );
}