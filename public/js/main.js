function setCookie(key, value, expiry=10) {
    var expires = new Date();
    expires.setTime(expires.getTime() + (expiry * 24 * 60 * 60 * 1000));
    document.cookie = key + '=' + value + ';expires=' + expires.toUTCString()+ ";path=/";
}

function clearCookies() {
  document.cookie = '';
}

function getCookie(key) {
    var keyValue = document.cookie.match('(^|;) ?' + key + '=([^;]*)(;|$)');
    return keyValue ? keyValue[2] : null;
}

function eraseCookie(key) {
    var keyValue = getCookie(key);
    setCookie(key, keyValue, '-1');
}

function readCart() {
  var products = []
  var currentProducts = getCookie('basket')

  if (currentProducts) {
    products = JSON.parse(atob(currentProducts))
  }

  return products
}

function addToCart(product, quantity, attributes) {
  var products = readCart()
  products.push({
    id: product,
    quantity: quantity,
    attributes: attributes
  })

  setCookie('basket', btoa(JSON.stringify(products)))
}

function goCheckout() {
  stripe = Stripe(STRIPE_KEY);

  $.post('/purchase/session',{
      successURL : window.location.protocol + '//'+window.location.host + '/order/',
      cancelURL : window.location.href,
  }, function(response){
      stripe.redirectToCheckout({
        sessionId: response.session
      }).then(function (result) {
        console.log(result)
      });
  })
}

$(function() {
  $("#addToCart").click(function() {
    var attributes = {}
    $(".product-attributes").each(function(){
        attributes[$(this).attr('name')] = $(this).val()
    })

    var quantity = parseInt($(".product-quantity").val())
    var product = $(".product-id").val()

    addToCart(product, quantity, attributes)

    bootbox.alert($("h1").text() + " added to cart")
  })

  $("#emptyCart").click(function() {
    eraseCookie('basket')
    window.location.reload()
  })

  $("#checkout").click(goCheckout)
})