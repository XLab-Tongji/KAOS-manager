function _inheritsLoose(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; subClass.__proto__ = superClass; }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

var Util = require('../util/common');

var Helper = require('./helper');

var Interaction = require('./base');

var Chart = require('../chart/chart');

var FilterPlugin = require('../plugin/filter');

var Pinch =
/*#__PURE__*/
function (_Interaction) {
  _inheritsLoose(Pinch, _Interaction);

  var _proto = Pinch.prototype;

  _proto.getDefaultCfg = function getDefaultCfg() {
    var defaultCfg = _Interaction.prototype.getDefaultCfg.call(this);

    return Util.mix({}, defaultCfg, {
      startEvent: 'pinchstart',
      processEvent: 'pinch',
      endEvent: 'pinchend',
      resetEvent: 'touchend',
      pressThreshold: 9,
      // Minimal movement that is allowed while pressing
      pressTime: 251,
      // Minimal press time in ms
      mode: 'x',
      currentPinchScaling: null,
      originValues: null,
      minScale: null,
      maxScale: null,
      _timestamp: 0,
      limitRange: {}
    });
  };

  function Pinch(cfg, chart) {
    var _this;

    _this = _Interaction.call(this, cfg, chart) || this;

    var self = _assertThisInitialized(_assertThisInitialized(_this));

    var hammer = self.hammer,
        pressThreshold = self.pressThreshold,
        pressTime = self.pressTime;
    hammer.get('pinch').set({
      // open pinch recognizer
      enable: true
    });
    chart.registerPlugins([FilterPlugin, {
      changeData: function changeData() {
        self.limitRange = {};
        self.originTicks = null;
      },
      clear: function clear() {
        self.limitRange = {};
        self.originTicks = null;
      }
    }]);
    var tooltipController = chart.get('tooltipController');

    if (tooltipController && tooltipController.enable) {
      chart.tooltip(false);
      hammer.get('press').set({
        threshold: pressThreshold,
        time: pressTime
      });
      hammer.on('press', Util.wrapBehavior(_assertThisInitialized(_assertThisInitialized(_this)), '_handlePress'));
    }

    return _this;
  }

  _proto.start = function start() {
    if (this.pressed) return;
    this.currentPinchScaling = 1;
  };

  _proto.process = function process(e) {
    if (this.pressed) return;

    this._handlePinch(e);
  };

  _proto.end = function end(e) {
    if (this.pressed) return;

    this._handlePinch(e);

    this.currentPinchScaling = null; // reset
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
    var center = e.center;
    this.chart.tooltip(true);
    this.chart.showTooltip(center);
  };

  _proto._handlePinch = function _handlePinch(e) {
    var currentPinchScaling = this.currentPinchScaling;
    var diff = 1 / currentPinchScaling * e.scale;
    var rect = e.target.getBoundingClientRect();
    var offsetX = e.center.x - rect.left;
    var offsetY = e.center.y - rect.top;
    var center = {
      x: offsetX,
      y: offsetY
    }; // fingers position difference

    var x = Math.abs(e.pointers[0].clientX - e.pointers[1].clientX);
    var y = Math.abs(e.pointers[0].clientY - e.pointers[1].clientY); // diagonal fingers will change both (xy) axes

    var p = x / y;
    var xy;

    if (p > 0.3 && p < 1.7) {
      xy = 'xy';
    } else if (x > y) {
      xy = 'x';
    } else {
      xy = 'y';
    }

    var lastTimestamp = this._timestamp;
    var now = +new Date();

    if (now - lastTimestamp > 16) {
      this._doZoom(diff, center, xy);

      this._timestamp = now;
    } // Keep track of overall scale


    this.currentPinchScaling = e.scale;
  };

  _proto._doZoom = function _doZoom(diff, center, whichAxes) {
    var self = this;
    var mode = self.mode,
        chart = self.chart,
        limitRange = self.limitRange; // Which axe should be modified when figers were used.

    var _whichAxes;

    if (mode === 'xy' && whichAxes !== undefined) {
      // based on fingers positions
      _whichAxes = whichAxes;
    } else {
      _whichAxes = 'xy';
    }

    var data = chart.get('data');

    if (Helper.directionEnabled(mode, 'x') && Helper.directionEnabled(_whichAxes, 'x')) {
      // x
      var xScale = chart.getXScale();
      var xField = xScale.field;

      if (!limitRange[xField]) {
        limitRange[xField] = Helper._getLimitRange(data, xScale);
      }

      if (xScale.isCategory) {
        // 横轴为分类类型
        self._zoomCatScale(xScale, diff, center);
      } else if (xScale.isLinear) {
        self._zoomLinearScale(xScale, diff, center, 'x');
      }

      var xDef = Helper.getColDef(chart, xField);
      this.xRange = Helper._getFieldRange(xDef, limitRange[xField], xScale.type);
    }

    if (Helper.directionEnabled(mode, 'y') && Helper.directionEnabled(_whichAxes, 'y')) {
      // y
      var yScales = chart.getYScales();
      Util.each(yScales, function (yScale) {
        var yField = yScale.field;

        if (!limitRange[yField]) {
          limitRange[yField] = Helper._getLimitRange(data, yScale);
        }

        yScale.isLinear && self._zoomLinearScale(yScale, diff, center, 'y');
      });
      var yDef = Helper.getColDef(chart, yScales[0].field);
      this.yRange = Helper._getFieldRange(yDef, limitRange[yScales[0].field], yScales[0].type);
    }

    chart.repaint();
  };

  _proto._zoomLinearScale = function _zoomLinearScale(scale, zoom, center, flag) {
    var type = scale.type;
    if (type !== 'linear') return;
    var field = scale.field;
    var chart = this.chart;
    var min = scale.min,
        max = scale.max;
    var valueRange = max - min;
    var limitRange = this.limitRange;
    var originRange = limitRange[field].max - limitRange[field].min;
    var coord = chart.get('coord');
    var colDef = Helper.getColDef(chart, field);
    var newDiff = valueRange * (zoom - 1);

    if (this.minScale && zoom < 1) {
      // zoom in
      var maxRange = originRange / this.minScale;
      newDiff = Math.max(valueRange - maxRange, newDiff);
    }

    if (this.maxScale && zoom >= 1) {
      // zoom out
      var minRange = originRange / this.maxScale;
      newDiff = Math.min(valueRange - minRange, newDiff);
    }

    var offsetPoint = coord.invertPoint(center);
    var percent = flag === 'x' ? offsetPoint.x : offsetPoint.y;
    var minDelta = newDiff * percent;
    var maxDelta = newDiff * (1 - percent);
    var newMax = max - maxDelta;
    var newMin = min + minDelta;
    chart.scale(field, Util.mix({}, colDef, {
      min: newMin,
      max: newMax,
      nice: false
    }));
  };

  _proto._zoomCatScale = function _zoomCatScale(scale, zoom, center) {
    var field = scale.field,
        values = scale.values;
    var chart = this.chart;
    var coord = chart.get('coord');
    var colDef = Helper.getColDef(chart, field);

    if (!this.originTicks) {
      // Need to be optimized
      this.originTicks = scale.ticks;
    }

    var originTicks = this.originTicks;
    var originValues = this.limitRange[field];
    var originValuesLen = originValues.length;
    var maxScale = this.maxScale || 4;
    var minScale = this.minScale || 1;
    var minCount = originValuesLen / maxScale;
    var maxCount = originValuesLen / minScale;
    var valuesLength = values.length;
    var offsetPoint = coord.invertPoint(center);
    var percent = offsetPoint.x;
    var deltaCount = parseInt(valuesLength * Math.abs(zoom - 1));
    var minDelta = parseInt(deltaCount * percent);
    var maxDelta = deltaCount - minDelta;

    if (zoom >= 1 && valuesLength >= minCount) {
      // zoom out
      var newValues = values.slice(minDelta, valuesLength - maxDelta);
      chart.scale(field, Util.mix({}, colDef, {
        values: newValues,
        ticks: originTicks
      }));
    } else if (zoom < 1 && valuesLength <= maxCount) {
      // zoom in
      var firstIndex = originValues.indexOf(values[0]);
      var lastIndex = originValues.indexOf(values[valuesLength - 1]);
      var minIndex = Math.max(0, firstIndex - minDelta);
      var maxIndex = Math.min(lastIndex + maxDelta, originValuesLen);

      var _newValues = originValues.slice(minIndex, maxIndex);

      chart.scale(field, Util.mix({}, colDef, {
        values: _newValues,
        ticks: originTicks
      }));
    }
  };

  return Pinch;
}(Interaction);

Chart.registerInteraction('pinch', Pinch);
module.exports = Pinch;