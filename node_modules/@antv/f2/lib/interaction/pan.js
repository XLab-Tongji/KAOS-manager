function _inheritsLoose(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; subClass.__proto__ = superClass; }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

var Util = require('../util/common');

var Helper = require('./helper');

var Interaction = require('./base');

var Chart = require('../chart/chart');

var FilterPlugin = require('../plugin/filter');

var DAY_TIMESTAMPS = 86400000;
var TOUCH_EVENTS = ['touchstart', 'touchmove', 'touchend', 'touchStart', 'touchMove', 'touchEnd'];

var Pan =
/*#__PURE__*/
function (_Interaction) {
  _inheritsLoose(Pan, _Interaction);

  var _proto = Pan.prototype;

  _proto.getDefaultCfg = function getDefaultCfg() {
    var defaultCfg = _Interaction.prototype.getDefaultCfg.call(this);

    defaultCfg = Util.mix({}, defaultCfg, {
      startEvent: 'panstart',
      processEvent: 'panmove',
      endEvent: 'panend',
      resetEvent: 'touchend',
      mode: 'x',
      panThreshold: 10,
      // Minimal pan distance required before recognizing
      pressThreshold: 9,
      // Minimal movement that is allowed while pressing
      pressTime: 251,
      // Minimal press time in ms
      currentDeltaX: null,
      currentDeltaY: null,
      panning: false,
      limitRange: {},
      _timestamp: 0,
      lastPoint: null
    });

    if (Util.isWx || Util.isMy) {
      // 小程序
      defaultCfg.startEvent = 'touchstart';
      defaultCfg.processEvent = 'touchmove';
      defaultCfg.endEvent = 'touchend';
    }

    return defaultCfg;
  };

  function Pan(cfg, chart) {
    var _this;

    _this = _Interaction.call(this, cfg, chart) || this;

    var self = _assertThisInitialized(_assertThisInitialized(_this));

    var hammer = self.hammer,
        panThreshold = self.panThreshold,
        pressThreshold = self.pressThreshold,
        pressTime = self.pressTime;

    if (hammer) {
      hammer.get('pan').set({
        threshold: panThreshold
      });
    }

    var tooltipController = chart.get('tooltipController');

    if (tooltipController && tooltipController.enable) {
      chart.tooltip(false);

      if (hammer) {
        hammer.get('press').set({
          threshold: pressThreshold,
          time: pressTime
        });
        hammer.on('press', Util.wrapBehavior(_assertThisInitialized(_assertThisInitialized(_this)), '_handlePress'));
      } else {
        Util.addEventListener(_this.el, 'press', Util.wrapBehavior(_assertThisInitialized(_assertThisInitialized(_this)), '_handlePress'));
      }
    }

    chart.registerPlugins([FilterPlugin, {
      changeData: function changeData() {
        self.limitRange = {};
      },
      clear: function clear() {
        self.limitRange = {};
      }
    }]);
    return _this;
  }

  _proto.start = function start(e) {
    if (this.pressed) return;
    this.currentDeltaX = 0;
    this.currentDeltaY = 0;

    if (e.type === 'touchstart' || e.type === 'touchStart') {
      this.lastPoint = e.touches[0];
    }

    this._handlePan(e);
  };

  _proto.process = function process(e) {
    if (this.pressed) return;

    this._handlePan(e);
  };

  _proto.end = function end() {
    if (this.pressed) return;
    this.currentDeltaX = null;
    this.currentDeltaY = null;
    this.lastPoint = null;
  };

  _proto.reset = function reset() {
    var chart = this.chart;

    if (chart.get('tooltipController')) {
      this.pressed = false;
      chart.hideTooltip();
      chart.tooltip(false);
    }
  };

  _proto._handlePress = function _handlePress(e) {
    this.pressed = true;
    var center = e.center || e.touches[0];
    this.chart.tooltip(true);
    this.chart.showTooltip(center);
  };

  _proto._handlePan = function _handlePan(e) {
    var currentDeltaX = this.currentDeltaX,
        currentDeltaY = this.currentDeltaY,
        lastPoint = this.lastPoint;
    var deltaX;
    var deltaY;

    if (TOUCH_EVENTS.indexOf(e.type) !== -1) {
      var currentPoint = e.touches[0];
      deltaX = currentPoint.x - lastPoint.x;
      deltaY = currentPoint.y - lastPoint.y;
      this.lastPoint = currentPoint;
    } else if (currentDeltaX !== null && currentDeltaY !== null) {
      this.panning = true;
      deltaX = e.deltaX - currentDeltaX;
      deltaY = e.deltaY - currentDeltaY;
      this.currentDeltaX = e.deltaX;
      this.currentDeltaY = e.deltaY;
    }

    if (!Util.isNil(deltaX) || !Util.isNil(deltaY)) {
      var lastTimestamp = this._timestamp;
      var now = +new Date();

      if (now - lastTimestamp > 16) {
        this._doPan(deltaX, deltaY);

        this._timestamp = now;
      }
    }
  };

  _proto._doPan = function _doPan(deltaX, deltaY) {
    var self = this;
    var mode = self.mode,
        chart = self.chart,
        limitRange = self.limitRange;
    var coord = chart.get('coord');
    var start = coord.start,
        end = coord.end;
    var data = chart.get('data');

    if (Helper.directionEnabled(mode, 'x') && deltaX !== 0) {
      var xScale = chart.getXScale();
      var xField = xScale.field;

      if (!limitRange[xField]) {
        limitRange[xField] = Helper._getLimitRange(data, xScale);
      }

      var coordWidth = end.x - start.x;

      if (xScale.isCategory) {
        self._panCatScale(xScale, deltaX, coordWidth);
      } else if (xScale.isLinear) {
        self._panLinearScale(xScale, deltaX, coordWidth, 'x');
      }

      var xDef = Helper.getColDef(chart, xField);
      this.xRange = Helper._getFieldRange(xDef, limitRange[xField], xScale.type);
    }

    if (Helper.directionEnabled(mode, 'y') && deltaY !== 0) {
      var coordHeight = start.y - end.y;
      var yScales = chart.getYScales();
      Util.each(yScales, function (yScale) {
        var yField = yScale.field;

        if (!limitRange[yField]) {
          limitRange[yField] = Helper._getLimitRange(data, yScale);
        }

        yScale.isLinear && self._panLinearScale(yScale, deltaY, coordHeight, 'y');
      });
      var yDef = Helper.getColDef(chart, yScales[0].field);
      this.yRange = Helper._getFieldRange(yDef, limitRange[yScales[0].field], yScales[0].type);
    }

    chart.repaint();
  };

  _proto._panLinearScale = function _panLinearScale(scale, delta, range, flag) {
    var field = scale.field,
        min = scale.min,
        max = scale.max;
    var limitRange = this.limitRange;
    if (min === limitRange[field].min && max === limitRange[field].max) return;
    var chart = this.chart;
    var ratio = delta / range;
    var panValue = ratio * (max - min);
    var newMax = flag === 'x' ? max - panValue : max + panValue;
    var newMin = flag === 'x' ? min - panValue : min + panValue;

    if (limitRange[field] && !Util.isNil(limitRange[field].min) && newMin <= limitRange[field].min) {
      newMin = limitRange[field].min;
      newMax = max - min + newMin;
    }

    if (limitRange[field] && !Util.isNil(limitRange[field].max) && newMax >= limitRange[field].max) {
      newMax = limitRange[field].max;
      newMin = newMax - (max - min);
    }

    var colDef = Helper.getColDef(chart, field);
    chart.scale(field, Util.mix({}, colDef, {
      min: newMin,
      max: newMax,
      nice: false
    }));
  };

  _proto._panCatScale = function _panCatScale(scale, delta, range) {
    var chart = this.chart;
    var type = scale.type,
        field = scale.field,
        values = scale.values,
        ticks = scale.ticks;
    var colDef = Helper.getColDef(chart, field);
    var originValues = this.limitRange[field];
    var ratio = delta / range;
    var valueLength = values.length;
    var deltaCount = Math.max(1, Math.abs(parseInt(ratio * valueLength)));
    var firstIndex = originValues.indexOf(values[0]);
    var lastIndex = originValues.indexOf(values[valueLength - 1]);

    if (delta > 0 && firstIndex >= 0) {
      // right
      for (var i = 0; i < deltaCount && firstIndex > 0; i++) {
        firstIndex -= 1;
        lastIndex -= 1;
      }

      var newValues = originValues.slice(firstIndex, lastIndex + 1);
      var newTicks = null;

      if (type === 'timeCat') {
        var tickGap = ticks.length > 2 ? ticks[1] - ticks[0] : DAY_TIMESTAMPS;

        for (var _i = ticks[0] - tickGap; _i >= newValues[0]; _i -= tickGap) {
          ticks.unshift(_i);
        }

        newTicks = ticks;
      }

      chart.scale(field, Util.mix({}, colDef, {
        values: newValues,
        ticks: newTicks
      }));
    } else if (delta < 0 && lastIndex <= originValues.length - 1) {
      // left
      for (var _i2 = 0; _i2 < deltaCount && lastIndex < originValues.length - 1; _i2++) {
        firstIndex += 1;
        lastIndex += 1;
      }

      var _newValues = originValues.slice(firstIndex, lastIndex + 1);

      var _newTicks = null;

      if (type === 'timeCat') {
        var _tickGap = ticks.length > 2 ? ticks[1] - ticks[0] : DAY_TIMESTAMPS;

        for (var _i3 = ticks[ticks.length - 1] + _tickGap; _i3 <= _newValues[_newValues.length - 1]; _i3 += _tickGap) {
          ticks.push(_i3);
        }

        _newTicks = ticks;
      }

      chart.scale(field, Util.mix({}, colDef, {
        values: _newValues,
        ticks: _newTicks
      }));
    }
  };

  return Pan;
}(Interaction);

Chart.registerInteraction('pan', Pan);
module.exports = Pan;