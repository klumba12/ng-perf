(function (angular) {

   angular.module('pe', [])
       .service('pe', pe)
       .directive('peStyle', peStyle);

   pe.$inject = ['$rootScope', '$parse'];
   peStyle.$inject = ['pe'];

   function Proxy(model, notify) {
      if (model) {
         var self = this;
         Object.keys(model)
             .forEach(function (key) {
                var temp = model[key];
                Object.defineProperty(self, key, {
                   get: function () {
                      return temp;
                   },
                   set: function (value) {
                      if (temp !== value) {
                         model[key] = temp = value;
                         notify({
                            source: model,
                            key: key,
                            value: value
                         });
                      }
                   }
                });
             });
      }
   }

   function pe($rootScope, $parse) {
      var watchers = [],
          isDirty = false;
          //digestQueue = [];

      function notify(e) {
         isDirty = true;
         //digestQueue.push(e);
      }

      function digest() {
         //digestQueue = [];
         isDirty = false;

         for (var i = 0, length = watchers.length; i < length; i++) {
            var w = watchers[i],
                newValue = w.get(),
                oldValue = w.value;

            if (newValue !== oldValue) {
               w.value = newValue;
               w.handler(newValue, oldValue);
            }
         }
      }

      function Pe() {
      }

      Pe.prototype.model = function (model) {
         return new Proxy(model, notify);
      };

      Pe.prototype.watch = function (scope) {
         return function (expression, handler) {
            var get = $parse(expression),
                value = get(scope),
                w = {
                   get: function(){
                      return get(scope);
                   },
                   handler: handler,
                   value: value
                };

            watchers.push(w);
            handler(value, value);

            return function () {
               var index = watchers.indexOf(w);
               if (index >= 0) {
                  watchers.splice(index, 1);
               }
            }
         }
      };

      $rootScope.$watch(function () {
         var i = 8;
         while (isDirty) {
            digest();
            if (i-- === 0) {
               throw  new Error('Reached maximum number of invalidate attempts');
            }
         }

         return true;
      }, angular.noop)

      return new Pe(watchers);
   }

   function peStyle(pe) {
      return {
         restrict: 'A',
         link: function (scope, element, attr) {
            var watch = pe.watch(scope);
            watch(attr.peStyle, function ngStyleWatchAction(newStyles, oldStyles) {
               if (oldStyles && (newStyles !== oldStyles)) {
                  angular.forEach(oldStyles, function (val, style) {
                     element.css(style, '');
                  });
               }
               if (newStyles) element.css(newStyles);
            }, true);
         }
      };
   }

})(angular);
