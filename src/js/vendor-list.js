import stickybits from "stickybits";
import flatpickr from "flatpickr";
import fuzzysort from "fuzzysort";

$(function() {
  var API_CALL_MADE = false;
  var VENDOR_DATA = {
    vendorList: [],
    bookedVendors: [],
    filteredResults: [],
    queryResults: []
  };
  var CURRENT_VENDOR_DATA;

  var IS_ACTIVE_SEARCH = false;
  var IS_ACTIVE_FILTER = false;

  var DISPLAY_INCREMENT = 0;
  var RESULTS_PER_PAGE = 36;
  var CURRENT_PAGE = 1;

  var loc, tag;
  
  update_tag();
  
  $(window).on('popstate', e => {
    update_tag();
  });

  const flatpickrConfig = {
    altInput: true,
    altFormat: "F j, Y",
    dateFormat: "Y-m-d",
    minDate: "today",
    static: true,
    onChange: function() {
      checkBookingInputs();
    }
  };

  const flatpickrTimeConfig = {
    enableTime: true,
    noCalendar: true,
    altInput: true,
    altFormat: "h:i K",
    dateFormat: "H:i:S",
    static: true,
    onChange: function() {
      checkBookingInputs();
    }
  };

  const fp = flatpickr("#bookDate", flatpickrConfig);
  const fpEndTime = flatpickr("#bookEndTime", flatpickrTimeConfig);
  const fpStartTime = flatpickr("#bookStartTime", Object.assign(flatpickrTimeConfig, {
    onChange: function() {
      fpEndTime.set("minDate", this.input.value);
      let startTimeStamp = this.parseDate(this.input.value);
      let endTimeStamp = fpEndTime.parseDate(fpEndTime.input.value);

      // Disallowing end time to be before start time. A server-side check is also made.
      if (startTimeStamp != null && endTimeStamp != null && startTimeStamp > endTimeStamp.getTime()) {
        fpEndTime.setDate(this.input.value, true);
      }

      checkBookingInputs();
    }
  }));
  
  function update_tag() {
    loc = window.location.href.split('#');
    tag = loc.length > 1 ? loc[1] : '';
    if (tag != '' && !API_CALL_MADE) {
      IS_ACTIVE_FILTER = true;
      getVendorByType(tag);
    } else if (!tag) {
      IS_ACTIVE_FILTER = false;
      getVendorByType("all");
    }
  }
  
  // Adding position:sticky polyfill for side menu to make sure it works in older browers
  var elements = $('.sticky');
  stickybits(elements, {stickyBitStickyOffset: 67});

  $.ajaxSetup({
    cache: false,
  });


  retrieveBookedVendors();
  addAjaxListeners();
  addSearchListener();
  addLoadListener();
  addDropdownMenuListeners();
  addBookingListeners();
  addBookFulfillmentListener();
  addCloseQuickviewListeners();
  addCheckboxListener();

  // ADDITIONAL CONVENIENCE METHODS //

  (function($) {
    $.fn.resetCheckbox = function() {
      var _ = this;
      if (_.prop("type") === "checkbox") _.prop("checked", false);

      return _;
    }

    $.fn.resetQuickview = function() {
      var _ = this;
      if (_.hasClass("quickview")) { // Check if bound element in a quickview component
        $("#confirmationView").remove();
        $("#defaultView").show();
      }

      return _;
    }
  })(jQuery);
  
  // UTILITIES //

  function isActiveSearch() {
    return $("#vendorSearch").val() != null;
  }

  function resetDisplayVariables() {
    DISPLAY_INCREMENT = 0;
    CURRENT_PAGE = 1;
  }

  function emptyVendorList() {
    $(".vendor-list-card-wrapper").empty().hide();
  }

  function buildErrorMessage(errorText, subMessage, hasIcon) {
    const $errorComponent = $(
      `<li class="no-results">
        <p class="has-text-centered has-text-grey is-size-5">
        ${hasIcon === true ?
          `<span class="icon has-text-danger">
            <i class="mdi mdi-alert-box"></i>
          </span>` : ``}
          <span>${errorText}</span>
          <br>
          <span class="is-size-7">${subMessage}</span>
        </p>
      </li>`
    );

    return $errorComponent;
  }

  function makeSidelinkActive(type) {
    // Remove all active classes from links
    $('.retrieve-vendors').removeClass('is-active');
    // Add active class to all vendors link (special case)
    if (type === "all") {
      $('.retrieve-vendors').eq(0).addClass('is-active');
    }
    // Add active class to link with href that corresponds to type passed in to AJAX call
    $('a[href="#' + type + '"]').addClass('is-active');
  }

  function updateResultsCount() {
    let arr = IS_ACTIVE_SEARCH ? VENDOR_DATA.queryResults : getCurrentList();

    $('#resultsIncrement').text(
      `1 - ${DISPLAY_INCREMENT}`
    );
    $('#vendorTotal').text(
      arr.length
    );
  }

  function getCurrentList() {
    if (IS_ACTIVE_FILTER) {
      return VENDOR_DATA.filteredResults;
    }

    return VENDOR_DATA.vendorList;
  }

  function clearSearchField() {
    $("#vendorSearch").val("");
    IS_ACTIVE_SEARCH = false;
  }

  function closeDropdowns() {
    $(".card-dropdown").removeClass("is-active");
  }

  function resetSorts() {
    $('.sortVendors').removeClass('is-active').children(".order-indicator").remove();
  }

  function goToTop() {
    $('html, body').animate({ scrollTop: 0 }, 300);
    return false;
  }

  // PRIMARY FUNCTIONS //

  function retrieveBookedVendors() {
    $.ajax({
      method: "GET",
      url: "/getvendors",
      data: {
        booked: "true"
      },
      timeout: 15000,
      dataType: "json",
      global: false
    })
    .done((data, textStatus, jqXHR) => {
      VENDOR_DATA.bookedVendors = data;
      updateBookingNotifiers(VENDOR_DATA.bookedVendors);
    })
    .fail((jqXHR, textStatus, errorThrown) => {
      console.log(jqXHR);
    });
  }

  function addDropdownMenuListeners() {
    $(document).on("click", ".card-dropdown", e => {
      closeDropdowns();
      e.stopPropagation();
      $(e.currentTarget).toggleClass("is-active");
    });
    $(document).on("click", e => {
      closeDropdowns();
    });
  }

  function updateBookingNotifiers(json) {
    $.each(json, (index, value) => {
      let $card = $(".vendor-list-card").find(`[data-vendor-id='${value}']`);
      if ($card.find(".booked").length === 0) {
        $card.find(".book-button").remove();
        $card.find(".dropdown-content").prepend(
          $('<span />', {"class": "dropdown-item has-text-success booked"}).append(
            $('<span />', {"class": "icon"}).append(
              $('<i />', {"class": "mdi mdi-check-circle"})
            )
          ).append(" Booked")
        )
      }
    });
  }

  function addAjaxListeners() {
    $('.retrieve-vendors').on('click', e => {
      goToTop();
      clearSearchField();
      resetSorts();

      let $self = $(e.currentTarget);
      let type = $self.attr('data-type');

      if (type === "all") {
        history.pushState({}, document.title, window.location.href.split('#')[0]);
        VENDOR_DATA.filteredResults = [];
        IS_ACTIVE_FILTER = false;
      } else {
        VENDOR_DATA.vendorList = [];
        IS_ACTIVE_FILTER = true;
      }

      API_CALL_MADE = true;

      makeSidelinkActive(type);
      getVendorByType(type);
    });

    $('.sortVendors').on('click', e => {
      const $self = $(e.currentTarget);
      const type = $self.attr('data-type');
      const order = $self.attr('data-order');
      const iconName = order == 'asc' ? 'mdi-arrow-up' : 'mdi-arrow-down';
      let sortTarget = IS_ACTIVE_SEARCH ? VENDOR_DATA.queryResults : getCurrentList();

      resetSorts();
      goToTop();
      $self.addClass('is-active');

      sortTarget = sortArray(sortTarget, type, order);

      $self.attr('data-order', order == 'asc' ? 'desc': 'asc');

      $self.append(
        $('<span />', {"class": "icon is-small order-indicator"}).append(
          $('<i />', {"class": `mdi ${iconName}`})
        )
      );

      emptyVendorList();
      resetDisplayVariables();    
      displayVendors(sortTarget);
    });
  }

  function sortArray(arr, type, order) {
    arr.sort(function(a, b) {
      // Controlling for different structure of query results
      if (IS_ACTIVE_SEARCH) { a = a.obj; b = b.obj }
      // a and b will here be two objects from the array
      // thus a[1] and b[1] will equal the names
      // if they are equal, return 0 (no sorting)
      if (a[type] == b[type]) {
        return 0;
      }
      if (a[type] > b[type]) {
        // if a should come after b, return 1
        if (order == 'asc') {
          return 1;
        } else {
          return -1;
        }
      } else {
        // if b should come after a, return -1
        if (order == 'asc') {
          return -1;
        } else {
          return 1;
        }
      }
    });
    return arr;
  }

  function addSearchListener() {
    // Still needs to control for IE 11 and lower counting click events as input. e.stopImmediatePropagation does not work.
    $("#vendorSearch").on("click", e => {
      e.stopImmediatePropagation();
      e.preventDefault();
    });
    
    $("#vendorSearch").on({
      'focus': e => {
        $(e.currentTarget).parent().addClass("is-active");
      }, 'blur': e => {
        $(e.currentTarget).parent().removeClass("is-active");
      }, 'input': e => {
        console.log("INPUT ENTERED")
        let $input = $(e.currentTarget).val();
        let currentList = getCurrentList();

        $(".load-more-field").addClass("is-hidden");

        IS_ACTIVE_SEARCH = $input === "" ? false : true;

        emptyVendorList();
        resetDisplayVariables();
        goToTop();
        resetSorts();

        if (IS_ACTIVE_SEARCH) {
          const options = {
            allowTypo: true,
            threshold: -999,
            keys: ['contactName', 'businessName', 'city'],
            scoreFn(a) { return Math.max(a[0] ? a[0].score : -1000, a[1] ? a[1].score - 75 : -1000, a[2] ? a[2].score - 100 : -1000) }
          };

          VENDOR_DATA.queryResults = fuzzysort.go($input, currentList, options);
          displayVendors(VENDOR_DATA.queryResults);

          return false;
        } else {
          VENDOR_DATA.queryResults = []
        }

        displayVendors(currentList);
        updateResultsCount();
      }
    });

    function isWorthyKeypress(a) {
      // Keyboard numbers, numpad numbers, letters
      if (a >= 48 && a <= 57 || a >= 96 && a <= 105 || a >= 65 && a <= 90) {
        return true;
      }

      switch(a) {
        case 8: // Backspace
          return true;
        case 13: // Enter
          return true;
        default: // Everything else
          return false;
      }
    }
  }

  function getVendorByType(type) {
    // Show AJAX loading animation

    $('#loadMore').prop("disabled", true);
    $('.overlay-container').show();
    $('.vendor-list-card .overlay').show();

    makeSidelinkActive(type);

    var t0 = Date.now();
    $.ajax({
      method: 'GET',
      url: '/getvendors',
      data: {
        "type": type
      },
      timeout: 15000,
      dataType: "json",
    })
    .done((data, textStatus, jqXHR) => {
      var t1 = Date.now();
      console.log("Time to finish request " + (t1 - t0) + " milliseconds.");

      if (IS_ACTIVE_FILTER) { // Loading data into correct lists
        VENDOR_DATA.filteredResults = data.vendors;
      } else {
        VENDOR_DATA.vendorList = data.vendors;
      }

      emptyVendorList();
      resetDisplayVariables();
      displayVendors(getCurrentList());
      updateResultsCount();

      API_CALL_MADE = false;
    })
    .fail((jqXHR, textStatus, errorThrown) => {
      if (jqXHR.readyState === 4) {
        // http error
        emptyVendorList();

        $('ul.vendor-list-card-wrapper').show().append(
          buildErrorMessage("Something went wrong.", "Please try again later.", true)
        );
      } else if (jqXHR.readyState === 0) {
        // network error
        emptyVendorList();
        
        $('ul.vendor-list-card-wrapper').show().append(
          buildErrorMessage("A network error occurred.", "Please check your connection and try again.", true)
        );
      }

      console.log(jqXHR);
    })
    .always(() => {
      $('.overlay-container').hide();
      $('.vendor-list-card .overlay').hide();
      $(".load-more-field").removeClass("is-hidden");
    });
  }

  function addLoadListener() {
    $("#loadMore").on("click", e => {
      const $this = $(e.currentTarget);
      $this.addClass("is-loading");

      CURRENT_PAGE++;
      displayVendors(getCurrentList());
      updateResultsCount();

      $this.removeClass("is-loading");
    });
  }

  function displayVendors(arr) {
    const $wrapper = $(".vendor-list-card-wrapper");

    if (arr.length === 0 && IS_ACTIVE_SEARCH) {
      var entityMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '/': '&#x2F;',
        '`': '&#x60;',
        '=': '&#x3D;'
      };
      
      function escapeHtml(string) {
        return String(string).replace(/[&<>"'`=\/]/g, function(s) {
          return entityMap[s];
        });
      };

      var search = $('#vendorSearch').val();

      $wrapper.append(
        buildErrorMessage(`No results found for "${escapeHtml(search)}"`, "Try narrowing your search.", false)
      );

      $wrapper.show();

      return false;
    }

    const icons = {
      "venue": `<svg class="card-icon" viewBox="0 0 20 20" preserveAspectRation="xMinYMin meet">
                  <path fill="#FFFFFF" d="m10,18a8,8 0 0 1 -8,-8a8,8 0 0 1 8,-8a8,8 0 0 1 8,8a8,8 0 0 1 -8,8m0,-18a10,10 0 0 0 -10,10a10,10 0 0 0 10,10a10,10 0 0 0 10,-10a10,10 0 0 0 -10,-10m0,10.5a1.5,1.5 0 0 1 -1.5,-1.5a1.5,1.5 0 0 1 1.5,-1.5a1.5,1.5 0 0 1 1.5,1.5a1.5,1.5 0 0 1 -1.5,1.5m0,-5.3c-2.1,0 -3.8,1.7 -3.8,3.8c0,3 3.8,6.5 3.8,6.5c0,0 3.8,-3.5 3.8,-6.5c0,-2.1 -1.7,-3.8 -3.8,-3.8z"></path>
                </svg>`,
      "photographer": `<svg class="card-icon" viewBox="0 0 20 18" preserveAspectRatio="xMinYMid meet">
                          <path fill="#FFFFFF" d="m2,2l3,0l2,-2l6,0l2,2l3,0a2,2 0 0 1 2,2l0,12a2,2 0 0 1 -2,2l-16,0a2,2 0 0 1 -2,-2l0,-12a2,2 0 0 1 2,-2m8,3a5,5 0 0 0 -5,5a5,5 0 0 0 5,5a5,5 0 0 0 5,-5a5,5 0 0 0 -5,-5m0,2a3,3 0 0 1 3,3a3,3 0 0 1 -3,3a3,3 0 0 1 -3,-3a3,3 0 0 1 3,-3z"></path>
                        </svg>`,
      "videographer": `<svg class="card-icon" viewBox="0 0 18 12" preserveAspectRatio="xMinYMid meet">
                          <path fill="#FFFFFF" d="m14,4.5l0,-3.5a1,1 0 0 0 -1,-1l-12,0a1,1 0 0 0 -1,1l0,10a1,1 0 0 0 1,1l12,0a1,1 0 0 0 1,-1l0,-3.5l4,4l0,-11l-4,4z"></path>
                        </svg>`,
      "caterer": `<svg class="card-icon" viewBox="0 0 22 22">
                    <path fill="#FFFFFF" d="m20,20l0,-4c0,-1.11 -0.9,-2 -2,-2l-1,0l0,-3c0,-1.11 -0.9,-2 -2,-2l-3,0l0,-2l-2,0l0,2l-3,0c-1.11,0 -2,0.89 -2,2l0,3l-1,0c-1.11,0 -2,0.89 -2,2l0,4l-2,0l0,2l22,0l0,-2m-11,-14a2,2 0 0 0 2,-2c0,-0.38 -0.1,-0.73 -0.29,-1.03l-1.71,-2.97l-1.72,2.97c-0.18,0.3 -0.28,0.65 -0.28,1.03a2,2 0 0 0 2,2z"></path>
                  </svg>`,
      "music": `<svg class="card-icon" viewBox="0 0 19 18" preserveAspectRatio="xMinYMid meet">
                  <path fill="#FFFFFF" d="m19,0l0,12.5a3.5,3.5 0 0 1 -3.5,3.5a3.5,3.5 0 0 1 -3.5,-3.5a3.5,3.5 0 0 1 3.5,-3.5c0.54,0 1.05,0.12 1.5,0.34l0,-5.87l-10,2.13l0,8.9a3.5,3.5 0 0 1 -3.5,3.5a3.5,3.5 0 0 1 -3.5,-3.5a3.5,3.5 0 0 1 3.5,-3.5c0.54,0 1.05,0.12 1.5,0.34l0,-8.34l14,-3z"></path>
                </svg>`,
      "cosmetics": `<svg class="card-icon" viewBox="0 0 364 433" preserveAspectRatio="xMinYMid meet">
                      <g>
                        <path fill="#FFFFFF" d="m284.888,117.03c-43.62,0 -79.106,35.487 -79.106,79.106l0,216.397c0,11.028 8.972,20 20,20l118.213,0c11.028,0 20,-8.972 20,-20l0,-216.396c0,-43.62 -35.487,-79.107 -79.107,-79.107z"></path>
                        <path fill="#FFFFFF" d="m155.888,293.783l-4.621,-127.843c-0.493,-13.627 -10.22,-25.117 -22.937,-28.461l0.079,-59.77c0.013,-9.725 -5.824,-22.225 -13.289,-28.459l-54.237,-45.287c-3.15,-2.63 -6.307,-3.963 -9.385,-3.963c-3.246,0 -6.166,1.575 -8.011,4.32c-1.536,2.285 -2.313,5.27 -2.309,8.871l0.116,124.28c-12.733,3.334 -22.474,14.832 -22.968,28.47l-4.621,127.843c-7.95,2.646 -13.705,10.142 -13.705,18.969l0,99.781c0,11.028 8.972,20 20,20l129.594,0c11.028,0 20,-8.972 20,-20l0,-99.781c-0.001,-8.827 -5.756,-16.324 -13.706,-18.97zm-117.922,-1.03l4.026,-111.364c0.248,-6.855 6.063,-12.464 12.923,-12.464l59.764,0c6.86,0 12.675,5.609 12.923,12.464l4.026,111.364l-93.662,0"></path>
                      </g>
                    </svg>`,
      "tailor": `<svg class="card-icon" viewBox="0 0 159.63 218.31" preserveAspectRatio="xMinYMin meet">
                    <path fill="#FFFFFF" d="m147.2832,126.225c-13.701,-34.254 -36.034,-54.336 -45.563,-61.749l2.815,-10.558c2.356,-2.014 6.079,-5.628 9.272,-10.646c5.866,-9.217 3.786,-16.223 3.309,-17.535c-0.587,-1.617 -1.714,-2.983 -3.19,-3.869c-0.222,-0.133 -0.686,-0.398 -1.361,-0.721l0,-13.647c0,-4.143 -3.358,-7.5 -7.5,-7.5c-4.142,0 -7.5,3.357 -7.5,7.5l0,11.501c-2.746,0.439 -5.407,1.328 -7.945,2.681c-4.035,2.152 -7.288,4.871 -9.806,7.484c-2.518,-2.613 -5.77,-5.332 -9.805,-7.483c-2.538,-1.354 -5.198,-2.243 -7.944,-2.682l0,-11.501c0,-4.143 -3.358,-7.5 -7.5,-7.5c-4.142,0 -7.5,3.357 -7.5,7.5l0,13.646c-0.677,0.324 -1.141,0.589 -1.363,0.723c-1.475,0.885 -2.601,2.251 -3.189,3.868c-0.476,1.311 -2.556,8.318 3.309,17.535c3.193,5.018 6.916,8.632 9.272,10.646l2.815,10.558c-9.529,7.413 -31.862,27.495 -45.563,61.749c-17.274,43.183 -11.458,83.978 -11.202,85.694c0.548,3.674 3.704,6.393 7.418,6.393l142.506,0c3.714,0 6.869,-2.719 7.417,-6.393c0.256,-1.715 6.071,-42.51 -11.202,-85.694z"></path>
                  </svg>`
    };

    while (DISPLAY_INCREMENT < RESULTS_PER_PAGE * CURRENT_PAGE && arr[DISPLAY_INCREMENT] !== undefined) {
      const promoted = Math.random() < 0.07 ? "promoted" : "";
      const value = IS_ACTIVE_SEARCH ? arr[DISPLAY_INCREMENT].obj : arr[DISPLAY_INCREMENT];
      
      const $vendorCardWrapper = $("<li />", {"class": `vendor-list-card ${promoted}`});

      const $level = $(
        `<nav class="level is-mobile box">
          <div class="level-item has-text-centered">
            <div>
              <p class="heading has-text-grey">Rate</p>
              <p>$${value.rate}.00/hr</p>
            </div>
          </div>
          <div class="level-item has-text-centered">
            <div>
              <p class="heading has-text-grey">Business</p>
              <p>${value.businessName}</p>
            </div>
          </div>
        </nav>`
      );

      const $card = $(`<article class="tile is-child card card-${value.vendorType}"></article>`);

      const $cardHeader = $(
        `<nav class="tile-header card-header-${value.vendorType}">
          <div class="icon is-pulled-left">
            ${icons[value.vendorType]}
          </div>
          <div class="is-pulled-right">
            <div class="dropdown is-right card-dropdown tooltip" data-tooltip="More actions">
              <div class="dropdown-trigger">
                <a class="card-header-icon" aria-controls="dropdown-menu">
                  <span class="icon">
                    <i class="mdi mdi-24px mdi-chevron-down" aria-hidden="true"></i>
                  </span>
                </a>
              </div>
              <div id="extra-actions" class="dropdown-menu" role="menu">
                <div class="dropdown-content">
                  <a class="dropdown-item book-button" data-show="quickview" data-target="bookingQuickview">
                    <span class="icon">
                      <i class="mdi mdi-plus-circle"></i>
                    </span> Book
                  </a>
                  <a class="dropdown-item" href="/portfolio">
                    <span class="icon">
                      <i class="mdi mdi-treasure-chest"></i>
                    </span> Portfolio
                  </a>
                </div>
              </div>
            </div>
          </div>
          <div class="is-pulled-right">
            <div class="book-button shortcut tooltip" data-vendor-id=${value.id} data-show="quickview" data-target="bookingQuickview" data-tooltip="Book">
              <div class="icon has-text-white book-icon">
                <i class="mdi mdi-plus-circle"></i>
              </div>
            </div>
          </div>
        </nav>`
      );

      const $overlay = $('<div class="overlay is-overlay"></div>');

      $card.append($cardHeader, $overlay);

      const $ratingStars = generateRatingStars(value.rating);

      const $cardContent = $(
        `<div class="card-content">
          <div class="header"></div>
          <div class="media">
            <div class="media-left">
              <div class="image is-64x64 profile-picture-container"></div>
            </div>
            <div class="media-content">
              <div class="profile-info-container">
                <p class="title is-4 vendor-name has-text-weight-medium" title="${value.contactName}">
                  ${value.contactName}
                </p>
                <div class="vendor-location">
                  ${value.city}, ${value.state}
                </div>
                ${$ratingStars}
              </div>
            </div>
          </div>
        </div>`
      );

      const $vendorBlurb = $(
        `<div class="content">
          <p class="vendor-blurb">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 
            Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
          </p>
          <a class="is-size-7" href="/portfolio">
            More...
          </a>
        </div>`
      );

      $cardContent.append($level, $vendorBlurb);
      $card.append($cardContent);
        
      $vendorCardWrapper.append($card);
      $wrapper.append($vendorCardWrapper);

      const $bookButton = $(`[data-vendor-id=${value.id}]`);
      $bookButton.data("vendorData", {
        id: value.id,
        contactName: value.contactName,
        businessName: value.businessName,
        rate: `$${value.rate}.00/hr`,
        vendorType: value.vendorType,
        rating: value.rating,
        address: value.address,
        cityState: `${value.city}, ${value.state}`,
      });

      DISPLAY_INCREMENT++;
    }

    // Modifying state of "load more" button based on if there are any more vendors to load
    if (DISPLAY_INCREMENT === arr.length) {
      $("#loadMore").prop("disabled", true).children().eq(0).text("ALL VENDORS LOADED");
    } else {
      $("#loadMore").prop("disabled", false).children().eq(0).text("LOAD MORE");
    }
    
    updateBookingNotifiers(VENDOR_DATA.bookedVendors);

    if (IS_ACTIVE_SEARCH) {
      $wrapper.show(0, function() {
        $(".load-more-field").removeClass("is-hidden");
      });
    } else {
      $wrapper.fadeIn(325, function() {
        $(".load-more-field").removeClass("is-hidden");
      });
    }
  }

  function generateRatingStars(rating) {
    let container = `<div class="rating-container" title="${rating} out of 5">`;
    let starClass;

    for (let i = 0; i < 5; i++) {
      starClass = i < rating ? "filled-star" : "empty-star";
      container += `<span class="icon is-small"><i class="mdi mdi-star ${starClass}"></i></span>`;
    }

    container += "</div>";

    return container;
  }

  // Functions for booking vendors

  function addBookingListeners() {
    $(document).on('click', '.book-button', e => {
      if (!localStorage.getItem("logged-in")) {
        alert("You must be logged in to book a vendor.");
      } else {
        CURRENT_VENDOR_DATA = $(e.currentTarget).data("vendorData");
        
        Object.entries(CURRENT_VENDOR_DATA).forEach(element => { // Loading vendor information into quickview body
          let $targetField = $(`#booking__${element[0]}`);
          let val = element[1];

          if ($targetField.length > 0) {
            $targetField.text(val).attr("title", val);
          }
        });

        $('#bookingQuickview').addClass("is-active");
        $('#quickviewCloseLayer').fadeIn(250);
      }
    });
  }

  function addCheckboxListener() {
    let $fullDayCheckbox = $("input#fullDay");
    let $fullDayCheckboxTarget = $fullDayCheckbox.siblings("label");
    let targetInput = fp.isMobile === true ? "mobileInput" : "altInput";

    $fullDayCheckboxTarget.on('click', e => {
      if ($fullDayCheckbox.prop("checked") === false) {
        fpStartTime.setDate("00:00:00", true);
        fpStartTime[targetInput].setAttribute("disabled", true);

        fpEndTime.setDate("23:59:00", true);
        fpEndTime[targetInput].setAttribute("disabled", true);
        console.log(fpEndTime);
      } else {
        fpStartTime.clear();
        fpStartTime[targetInput].removeAttribute("disabled");

        fpEndTime.clear();
        fpEndTime[targetInput].removeAttribute("disabled");
      }
    })
  }

  function checkBookingInputs() {
    $("input[type=hidden]").each(function(idx, element) {
      if ($(element).val() == "") {
        $("#bookSubmit").attr("disabled", "disabled").attr("aria-disabled", true);
        return false;
      } 

      $("#bookSubmit").removeAttr("disabled").attr("aria-disabled", false);
    });
  }

  function addCloseQuickviewListeners() {
    $(document).on('click', '[data-dismiss="quickview"]', e => {
      let target = $(e.currentTarget).attr("data-target");

      $(target).removeClass("is-active");
      $('#quickviewCloseLayer').fadeOut(250);

      // If AJAX request was fired, regardless of result, we will remove the entire quickview display
      // Otherwise, we just clear the inputs and move on.
      if ($(target).attr("data-submitted") == "true") {
        setTimeout(() => {
          $(target).resetQuickview();
          $('#bookSubmit').show();
        }, 250);
      }
      fp.clear();
      fpStartTime.clear();
      fpEndTime.clear();

      let targetInput = fp.isMobile === true ? "mobileInput" : "altInput";
      fpStartTime[targetInput].removeAttribute("disabled");
      fpEndTime[targetInput].removeAttribute("disabled");

      $("input#fullDay").resetCheckbox();
    });
  }

  function addBookFulfillmentListener() {
    $('#bookSubmit').on('click', e => {
      postBookRequest();
    });
  }

  function postBookRequest() {
    // Show AJAX booking animation
    $('.quickview .overlay').fadeIn("fast");
    $('#bookSubmit').addClass('is-loading');

    let data = $('form#bookingDetailsForm').serializeArray();
    data.push({ name: 'vendor_id', value: CURRENT_VENDOR_DATA.id });
    console.log(data);

    $.post({
      url: "/book",
      data: data,
      dataType: "json",
      timeout: 15000
    })
    .done((data, textStatus, jqXHR) => {
      console.log(jqXHR);
      displayBookingConfirmation(data.bookingInfo);
    })
    .fail((jqXHR, textStatus, errorThrown) => {
      console.log(jqXHR, textStatus, errorThrown);

      if (jqXHR.getResponseHeader("X-Authorization-Required") == "true") {
        createErrorMessage("You must be logged in as a user in order to book vendors.")
        $('#bookSubmit').attr("disabled", "disabled");
      } else if (jqXHR.readyState === 4) {
        // HTTP error (can be checked by XMLHttpRequest.status and XMLHttpRequest.statusText)
        if (jqXHR.responseJSON.message != null) {
          createErrorMessage(jqXHR.responseJSON.message);
        }

        $('#bookSubmit').attr("disabled", "disabled");
      } else if (jqXHR.readyState === 0) {
        // Network error (i.e. connection refused, access denied due to CORS, etc.)
        createErrorMessage("A network error occurred. Please try again at a later time.");
      } else {
        // something weird is happening
      }
    })
    .always(() => {
      $("#bookingQuickview").attr("data-submitted", true);
      $('.quickview .overlay').fadeOut("fast");
      $('#bookSubmit').removeClass('is-loading');
    });
  }

  function displayBookingConfirmation(data) {
    const { bookDate, bookStartTime, bookEndTime, businessName, contactName, location, fullDay } = data;
    console.log(bookDate, bookStartTime, contactName);

    const $submitButton = $('#bookSubmit');
    $submitButton.fadeOut();

    const $container = $('.quickview-block');

    const $bookInformationComponent = $(
      `<summary id="confirmationView">
        <h3 class="title is-4">Booking confirmed!</h3>
        <p class="subtitle is-6">Your booking details are below:</p>
        <hr>
        <div class="notification is-primary-bold">
          <div class="level is-vertical">
            <div class="level-item spans-container">
              <p class="heading">
                <span class="icon is-small">
                  <i class="mdi mdi-account"></i>
                </span>
                Vendor Information
              </p>
              <article class="media spans-container">
                <figure class="media-left small-margin">
                  <div class="image is-32x32 profile-picture-container is-borderless">
                    <img src="http://placekitten.com/32/32">
                  </div>
                </figure>
                <figure class="media-content">
                  <div class="content">
                    <p class="has-text-weight-bold is-marginless">${contactName}</p>
                    <p class="is-size-7">${location}</p>
                  </div>
                </figure>
              </article>
            </div>
            <div class="level-item">
              <p class="heading">
                <span class="icon is-small">
                  <i class="mdi mdi-calendar"></i>
                </span>
                Date
              </p>
              <p class="has-text-weight-semibold">
                ${bookDate}
              </p>
            </div>
            <div class="level-item">
              <p class="heading">
                <span class="icon is-small">
                  <i class="mdi mdi-clock"></i>
                </span>
                Start Time
              </p>
              <p class="has-text-weight-semibold">
                ${bookStartTime}
              </p>
            </div>
            <div class="level-item">
              <p class="heading">
                <span class="icon is-small">
                  <i class="mdi mdi-clock"></i>
                </span>
                End Time
              </p>
              <p class="has-text-weight-semibold">
                ${fullDay === true ? "End of day" : bookEndTime}
              </p>
            </div>
          </div>
        </div>
      </summary>`
    );

    $container.addClass("is-sliding").parent().toggleClass("is-clipped");

    setTimeout(() => {
      $('#defaultView').hide(); // Empty container
      $container.append($bookInformationComponent); // Append confirmation message to container
      $container.removeClass("is-sliding").parent().toggleClass("is-clipped"); // Slide and fade the message up

      setTimeout(() => {
        $bookInformationComponent.find(".notification").addClass("is-shown");
      }, 275);
    }, 275); // Controlling for 275ms transition
    
    // VENDOR_DATA.bookedVendors.push(id);
    // updateBookingNotifiers(VENDOR_DATA.bookedVendors);
  }

  function createErrorMessage(err) {
    const $errMessage = $(
      `<footer class="quickview-footer quickview-error has-background-danger is-active">
          <span class="is-size-7 has-text-white">
            <span class="icon is-small">
              <i class="mdi mdi-alert-circle"></i>
            </span>
            ${err}
          </span>
      </footer>`
    );

    $('#bookingQuickview').append($errMessage);

    $errMessage.on('click', e => {
      dismissError();
      return false;
    });

    setTimeout(() => {
      dismissError();
    }, 4000);

    function dismissError() {
      $errMessage.removeClass("is-active");
      setTimeout(() => {
        $errMessage.remove();
      }, 275);
    }
  }
});
