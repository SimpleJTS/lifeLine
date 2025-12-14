import React, { useState, useEffect } from 'react';
import { Gender } from '../types';
import { MapPin, Calendar, Clock, Zap, ChevronDown, Sparkles } from 'lucide-react';

// 动态导入 lunar-javascript 以减少初始加载
let Lunar: any, Solar: any, EightChar: any;

const loadLunarLib = async () => {
  if (!Lunar) {
    const lib = await import('lunar-javascript');
    Lunar = lib.Lunar;
    Solar = lib.Solar;
    EightChar = lib.EightChar;
  }
};

interface SmartBaziInputProps {
  onBaziCalculated: (data: {
    birthYear: string;
    yearPillar: string;
    monthPillar: string;
    dayPillar: string;
    hourPillar: string;
    startAge: string;
    firstDaYun: string;
  }) => void;
  gender: Gender;
}

// 中国主要城市时区数据 (用于真太阳时计算)
const CHINA_CITIES = [
  { name: '北京', longitude: 116.4, offset: 0 },
  { name: '上海', longitude: 121.5, offset: 0 },
  { name: '广州', longitude: 113.3, offset: 0 },
  { name: '深圳', longitude: 114.1, offset: 0 },
  { name: '成都', longitude: 104.1, offset: 0 },
  { name: '重庆', longitude: 106.5, offset: 0 },
  { name: '武汉', longitude: 114.3, offset: 0 },
  { name: '西安', longitude: 108.9, offset: 0 },
  { name: '杭州', longitude: 120.2, offset: 0 },
  { name: '南京', longitude: 118.8, offset: 0 },
  { name: '天津', longitude: 117.2, offset: 0 },
  { name: '苏州', longitude: 120.6, offset: 0 },
  { name: '郑州', longitude: 113.6, offset: 0 },
  { name: '长沙', longitude: 112.9, offset: 0 },
  { name: '沈阳', longitude: 123.4, offset: 0 },
  { name: '青岛', longitude: 120.4, offset: 0 },
  { name: '哈尔滨', longitude: 126.6, offset: 0 },
  { name: '昆明', longitude: 102.7, offset: 0 },
  { name: '乌鲁木齐', longitude: 87.6, offset: 0 },
  { name: '拉萨', longitude: 91.1, offset: 0 },
];

const SmartBaziInput: React.FC<SmartBaziInputProps> = ({ onBaziCalculated, gender }) => {
  const [birthDate, setBirthDate] = useState('');
  const [birthTime, setBirthTime] = useState('12:00');
  const [selectedCity, setSelectedCity] = useState('北京');
  const [calculatedBazi, setCalculatedBazi] = useState<any>(null);
  const [error, setError] = useState('');

  const calculateBazi = async () => {
    try {
      setError('');

      if (!birthDate) {
        setError('请选择出生日期');
        return;
      }

      // 动态加载 lunar-javascript
      await loadLunarLib();

      // 解析日期和时间
      const [year, month, day] = birthDate.split('-').map(Number);
      const [hour, minute] = birthTime.split(':').map(Number);

      // 计算真太阳时偏移 (中国标准时间使用东经120度,计算各地偏移)
      const city = CHINA_CITIES.find(c => c.name === selectedCity);
      const longitudeOffset = city ? (city.longitude - 120) * 4 : 0; // 每度经度4分钟时差

      // 调整时间
      let adjustedHour = hour;
      let adjustedMinute = minute + longitudeOffset;

      if (adjustedMinute >= 60) {
        adjustedHour += Math.floor(adjustedMinute / 60);
        adjustedMinute = adjustedMinute % 60;
      } else if (adjustedMinute < 0) {
        adjustedHour -= Math.ceil(Math.abs(adjustedMinute) / 60);
        adjustedMinute = 60 + (adjustedMinute % 60);
      }

      if (adjustedHour >= 24) adjustedHour -= 24;
      if (adjustedHour < 0) adjustedHour += 24;

      // 创建Solar对象并转换
      const solar = Solar.fromYmdHms(year, month, day, adjustedHour, adjustedMinute, 0);
      const lunar = solar.getLunar();
      const eightChar = lunar.getEightChar();

      // 获取四柱
      const yearPillar = eightChar.getYear();
      const monthPillar = eightChar.getMonth();
      const dayPillar = eightChar.getDay();
      const hourPillar = eightChar.getTime();

      // 计算大运
      const yun = eightChar.getYun(gender === Gender.MALE ? 1 : 0);
      const daYuns = yun.getDaYun();

      // 获取起运信息（从 Yun 对象直接获取）
      const startYear = yun.getStartYear();  // 起运年数
      const startMonth = yun.getStartMonth(); // 起运月数
      const startDay = yun.getStartDay();    // 起运天数

      // 计算虚岁起运年龄：起运年 + 1（因为虚岁出生即1岁）
      const startAge = startYear + 1;

      // 获取第一步大运干支
      const firstDaYun = daYuns && daYuns.length > 0 ? daYuns[0].getGanZhi() : '';

      // 判断大运顺逆（用于显示）
      const isForward = yun.isForward();
      const direction = isForward ? '顺行' : '逆行';

      // 根据性别和年柱天干判断顺逆说明
      const yearStem = yearPillar.charAt(0);
      const yangStems = ['甲', '丙', '戊', '庚', '壬'];
      const isYangYear = yangStems.includes(yearStem);

      let directionNote = '';
      if (gender === Gender.MALE) {
        directionNote = isYangYear ? '(阳男顺行)' : '(阴男逆行)';
      } else {
        directionNote = isYangYear ? '(阳女逆行)' : '(阴女顺行)';
      }

      const baziData = {
        birthYear: year.toString(),
        yearPillar,
        monthPillar,
        dayPillar,
        hourPillar,
        startAge: startAge.toString(),
        firstDaYun,
        lunarDate: lunar.toString(),
        solarTerm: lunar.getJieQi(),
        direction: direction + directionNote,  // 大运方向说明
        startDetail: `${startYear}年${startMonth}个月${startDay}天`, // 详细起运时间
      };

      setCalculatedBazi(baziData);
      onBaziCalculated(baziData);

    } catch (err: any) {
      setError('计算八字时出错: ' + err.message);
      console.error(err);
    }
  };

  // 自动计算当用户输入完成时
  useEffect(() => {
    if (birthDate && birthTime) {
      calculateBazi();
    }
  }, [birthDate, birthTime, selectedCity, gender]);

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-6 rounded-2xl border border-indigo-200 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="bg-indigo-600 text-white p-2 rounded-lg">
          <Zap className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-800">智能八字计算</h3>
          <p className="text-xs text-gray-600">填写出生信息,自动生成准确八字</p>
        </div>
      </div>

      {/* 出生日期 */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-600" />
          出生日期 (阳历)
        </label>
        <input
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          min="1900-01-01"
          max="2100-12-31"
          className="w-full px-4 py-2.5 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white font-medium"
        />
      </div>

      {/* 出生时间 */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-600" />
          出生时间
        </label>
        <input
          type="time"
          value={birthTime}
          onChange={(e) => setBirthTime(e.target.value)}
          className="w-full px-4 py-2.5 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white font-medium"
        />
      </div>

      {/* 出生地点 */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-indigo-600" />
          出生地点 (用于真太阳时修正)
        </label>
        <div className="relative">
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="w-full px-4 py-2.5 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white font-medium appearance-none pr-10"
          >
            {CHINA_CITIES.map((city) => (
              <option key={city.name} value={city.name}>
                {city.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 计算结果预览 */}
      {calculatedBazi && (
        <div className="bg-white rounded-xl p-4 border border-indigo-200">
          <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            计算结果
          </h4>
          <div className="grid grid-cols-4 gap-2 mb-3">
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">年柱</div>
              <div className="font-bold text-lg text-indigo-700 font-serif-sc">{calculatedBazi.yearPillar}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">月柱</div>
              <div className="font-bold text-lg text-indigo-700 font-serif-sc">{calculatedBazi.monthPillar}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">日柱</div>
              <div className="font-bold text-lg text-indigo-700 font-serif-sc">{calculatedBazi.dayPillar}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">时柱</div>
              <div className="font-bold text-lg text-indigo-700 font-serif-sc">{calculatedBazi.hourPillar}</div>
            </div>
          </div>
          <div className="space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-indigo-50 rounded-lg p-2">
                <span className="text-gray-600">农历：</span>
                <span className="font-medium text-gray-800">{calculatedBazi.lunarDate}</span>
              </div>
              <div className="bg-indigo-50 rounded-lg p-2">
                <span className="text-gray-600">节气：</span>
                <span className="font-medium text-gray-800">{calculatedBazi.solarTerm || '无'}</span>
              </div>
            </div>
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg p-3 border border-indigo-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-700 font-bold">大运信息</span>
                <span className="text-indigo-600 font-bold text-xs">{calculatedBazi.direction}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <span className="text-gray-600">起运年龄：</span>
                  <span className="font-bold text-indigo-700">{calculatedBazi.startAge}岁（虚岁）</span>
                </div>
                <div>
                  <span className="text-gray-600">第一步：</span>
                  <span className="font-bold text-indigo-700 font-serif-sc">{calculatedBazi.firstDaYun}</span>
                </div>
              </div>
              <div className="mt-1 text-xs text-gray-500">
                精确起运: {calculatedBazi.startDetail}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartBaziInput;
