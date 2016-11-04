(function (angular, undefined) {

   angular.module('pe', [])
       .service('pe', pe)
       .directive('peStyle', peStyle)
       .directive('peBind', peBind);

   pe.$inject = ['$rootScope', '$parse'];
   peStyle.$inject = ['pe'];
   peBind.$inject = ['$compile', 'pe'];

   var isArray = angular.isArray,
       isDate = angular.isDate,
       isFunction = angular.isFunction,
       isDefined = angular.isDefined,
       toString = Object.prototype.toString;

   function isRegExp(value) {
      return toString.call(value) === '[object RegExp]';
   }

   function isWindow(obj) {
      return obj && obj.window === obj;
   }

   function isScope(obj) {
      return obj && obj.$evalAsync && obj.$watch;
   }

   function equals(o1, o2) {
      if (o1 === o2) return true;
      if (o1 === null || o2 === null) return false;
      if (o1 !== o1 && o2 !== o2) return true; // NaN === NaN
      if (typeof o1 === 'object' && typeof o2 === 'object') {
         var t1 = toString.call(o1);
         var length, key, keySet
         if (t1 === '[object Array]') {
            if (toString.call(o2) !== '[object Array]') return false;
            if ((length = o1.length) === o2.length) {
               for (key = 0; key < length; key++) {
                  if (!equals(o1[key], o2[key])) return false;
               }
               return true;
            }
         } else if (t1 === '[object Date]') {
            if (toString.call(o2) !== '[object Date]') return false;
            return equals(o1.getTime(), o2.getTime());
         } else if (t1 === '[object RegExp]') {
            if (toString.call(o2) !== '[object RegExp]') return false;
            return o1.toString() === o2.toString();
         } else {
            if (isScope(o1) || isScope(o2) || isWindow(o1) || isWindow(o2) ||
                isArray(o2) || isDate(o2) || isRegExp(o2)) return false;
            keySet = Object.create(null);
            for (key in o1) {
               if (key.charAt(0) === '$') continue;
               var v = o1[key];

               if (isFunction(v)) continue;
               if (!equals(v, o2[key])) return false;
               keySet[key] = true;
            }
            for (key in o2) {
               if (!(key in keySet) &&
                   key.charAt(0) !== '$') {
                  var v = o2[key];
                  if (isDefined(v) && !isFunction(v)) return false;
               }
            }
            return true;
         }
      }
      return false;
   }

   function camelCase(name) {
      var length = name.length,
          result = '',
          capitalize = false;

      for (var i = 0; i < length; i++) {
         var c = name.charAt(i);
         if (c === ':' || c === '-' || c === '_') {
            capitalize = true;
            continue;
         }

         if (capitalize) {
            result += c.toUpperCase();
            capitalize = false;
         }
         else {
            result += c;
         }
      }

      if (result.charAt(0) === 'm' &&
          result.charAt(1) === 'o' &&
          result.charAt(2) === 'z') {
         var n = result.charAt(3);
         if (n && n.toUpperCase() === n) {
            result[0] = 'M';
         }
      }


      return result;
   }

   function stringify(value) {
      if (value == null) {
         return '';
      }
      switch (typeof value) {
         case 'string':
            break;
         case 'number':
            value = '' + value;
            break;
         default:
            value = angular.toJson(value);
      }

      return value;
   }


   function pe($rootScope, $parse) {
      var watchers = [],
          isDirty = false;

	  function peObject(model) {
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
	                         isDirty = true;
	                      }
	                   }
	                });
	             });
	      }
   	  }

      function digest() {
         isDirty = false;

         for (var i = 0, length = watchers.length; i < length; i++) {
            var w = watchers[i],
                newValue = w.get(),
                oldValue = w.value;

            if (!equals(newValue, oldValue)) {
               w.value = newValue;
               w.handler(newValue, oldValue);
            }
         }
      }

      function Pe() {
      }

      Pe.prototype.model = function (model) {
         return new peObject(model);
      };

      Pe.prototype.watch = function (scope) {
         return function (expression, handler) {
            var get = $parse(expression),
                value = get(scope),
                w = {
                   get: function () {
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
         restrict: 'AC',
         link: function (scope, element, attr) {
            var watch = pe.watch(scope),
                node = element[0],
                convertToCamelCase = !!attr.peCamelCase;

            watch(attr.peStyle, function peStyleWatchAction(newStyles, oldStyles) {
               if (oldStyles && (newStyles !== oldStyles)) {
                  for (var key in oldStyles) {
                     var name = convertToCamelCase ? camelCase(key) : key;
                     node.style[name] = '';
                  }
               }

               if (newStyles) {
                  for (var key in newStyles) {
                     var name = convertToCamelCase ? camelCase(key) : key;
                     node.style[name] = newStyles[key];
                  }
               }
            });
         }
      };
   }

   function peBind($compile, pe) {
      return {
         restrict: 'AC',
         compile: function ngBindCompile(templateElement) {
            $compile.$$addBindingClass(templateElement);
            return function ngBindLink(scope, element, attr) {
               var watch = pe.watch(scope);
               $compile.$$addBindingInfo(element, attr.peBind);
               element = element[0];
               watch(attr.peBind, function peBindWatchAction(value) {
                  element.textContent = stringify(value);
               });
            };
         }
      };
   };

})(angular);
