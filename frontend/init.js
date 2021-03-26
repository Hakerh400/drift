(function(){
  'use strict';

  window.addEventListener('load', function(){
    var O = {
      doc: document,
      body: document.body,

      init: function(){
        var noscript = document.querySelector('noscript');
        var html = noscript.innerHTML;

        noscript.parentNode.removeChild(noscript);

        function err(){
          document.write('<!DOCTYPE html>\n' + html.split('&lt;').join('<').split('&gt;').join('>'));
        }

        var ok = 0;

        try{
          ok = new Function('class A{#a;constructor(a){this.#a=a};get m(){return this.#a}};return new A(5n).m===5n')();
        }catch(e){}

        if(!ok) return err();

        O.rf('/omikron/src/omikron/omikron.js?_=1', function(status, script){
          if(status != 200) return O.fatalError('Cannot load framework script. Try disabling extensions.');
          new Function(script)();
        });
      },

      fatalError: function(msg){
        var h1 = O.doc.createElement('h1');
        var t = O.doc.createTextNode('Fatal Error');
        O.body.appendChild(h1);
        h1.appendChild(t);
        t = O.doc.createTextNode(msg);
        O.body.appendChild(t);
      },

      urlTime: function(url){
        var char = url.indexOf('?') != -1 ? '&' : '?';
        return '' + url + char + '_=' + Date.now();
      },

      rf: function(file, cb){
        var xhr = new window.XMLHttpRequest();
        xhr.onreadystatechange = function(){
          if(xhr.readyState == 4){
            cb(xhr.status, xhr.responseText);
          }
        };
        xhr.open('GET', O.urlTime(file));
        xhr.send();
      }
    };

    O.init();
  });
})();