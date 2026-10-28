// Read-only driver details (name, phone, NID, pictures) for rickshaw owners,
// and the list of the drivers on an owner's rickshaws.
(function () {
  var RM = window.RM;
  var U = RM.util, D = RM.data, B = RM.biz;

  /** Rickshaw numbers a driver has today. */
  function currentRickshaws(driverId) {
    var today = U.today();
    return D.list('assignments').filter(function (a) {
      return a.driver_id === driverId && a.start_date <= today && (!a.end_date || a.end_date >= today);
    }).map(function (a) { return B.rickshawNumber(a.rickshaw_id); }).filter(Boolean);
  }

  RM.installers.push(function (app) {
    app.component('driver-info', {
      props: { driver: Object },
      emits: ['close'],
      computed: {
        rickshaws: function () { return currentRickshaws(this.driver.id); },
        hasNid: function () { return !!(this.driver.nid_front_id || this.driver.nid_back_id); },
      },
      methods: {
        url: function (id) { return RM.files.url(id); },
        zoom: function (id) { var u = RM.files.url(id); if (u) RM.ui.lightbox = u; },
      },
      template: '<sheet :title="driver.name" @close="$emit(\'close\')">' +
        '<div class="di-top"><button class="di-photo" @click="zoom(driver.photo_id)"><avatar :id="driver.photo_id" :name="driver.name" :size="96"/></button>' +
        '<div class="di-who"><b>{{ driver.name }}</b>' +
        '<a v-if="driver.phone" class="btn soft sm" :href="\'tel:\' + driver.phone"><ic name="phone" :size="16"/> {{ driver.phone }}</a></div></div>' +
        '<div v-if="rickshaws.length" class="di-row"><span>{{ $t(\'driver.rickshaws\') }}</span><b>{{ rickshaws.join(\', \') }}</b></div>' +
        '<div v-if="driver.nid" class="di-row"><span>{{ $t(\'setup.nid\') }}</span><b>{{ driver.nid }}</b></div>' +
        '<div v-if="hasNid" class="di-nid">' +
        '<div v-if="driver.nid_front_id"><small class="muted">{{ $t(\'setup.nidFront\') }}</small><button class="nid-thumb" @click="zoom(driver.nid_front_id)"><img v-if="url(driver.nid_front_id)" :src="url(driver.nid_front_id)" alt=""><span v-else class="spinner small"></span></button></div>' +
        '<div v-if="driver.nid_back_id"><small class="muted">{{ $t(\'setup.nidBack\') }}</small><button class="nid-thumb" @click="zoom(driver.nid_back_id)"><img v-if="url(driver.nid_back_id)" :src="url(driver.nid_back_id)" alt=""><span v-else class="spinner small"></span></button></div>' +
        '</div>' +
        '<p v-if="!driver.phone && !driver.nid && !hasNid" class="muted center-t">{{ $t(\'driver.noInfo\') }}</p>' +
        '</sheet>',
    });

    app.component('page-drivers', {
      data: function () { return { sel: null }; },
      computed: {
        list: function () {
          return D.list('drivers').slice().sort(function (a, b) { return U.natural(a.name, b.name); }).map(function (d) {
            return { d: d, rick: currentRickshaws(d.id) };
          });
        },
      },
      template: '<div class="page">' +
        '<empty v-if="!list.length" icon="user" :text="$t(\'driver.none\')"/>' +
        '<div v-for="x in list" :key="x.d.id" class="row-card" @click="sel = x.d">' +
        '<avatar :id="x.d.photo_id" :name="x.d.name" :size="46"/>' +
        '<div class="rc-main"><b>{{ x.d.name }}</b><span class="muted">{{ x.d.phone }}</span></div>' +
        '<div class="rc-side"><span v-if="x.rick.length" class="tag occupied">{{ x.rick.join(\', \') }}</span></div></div>' +
        '<driver-info v-if="sel" :driver="sel" @close="sel = null"/>' +
        '</div>',
    });
  });
})();
