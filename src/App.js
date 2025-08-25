import React, { useState, useEffect, useCallback } from 'react'; // Added useCallback here

// A simple custom alert/message box component
const MessageBox = ({ message, onClose }) => {
  if (!message) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm mx-auto text-center border border-gray-200">
        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-lg font-semibold text-gray-800 mb-4">{message}</p>
        <button
          onClick={onClose}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-lg hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-300 transition-all duration-200 ease-in-out transform hover:scale-105 shadow-lg"
        >
          Got it
        </button>
      </div>
    </div>
  );
};

const App = () => {
  // --- Input States for Acid Calculation ---
  const [alkalinityMakeup, setAlkalinityMakeup] = useState('');
  const [alkalinityDesired, setAlkalinityDesired] = useState('');
  const [acidType, setAcidType] = useState('sulfuric'); // Default to 98% Sulfuric Acid
  const [calculationBase, setCalculationBase] = useState('manual_makeup'); // 'manual_makeup', 'manual_blowdown', 'cw_data'
  const [manualFlowRate, setManualFlowRate] = useState(''); // For manual input of makeup/blowdown

  // --- Input States for Cooling Water Data Calculation (New) ---
  const [recirculationFlow, setRecirculationFlow] = useState(''); // m3/hr
  const [diffTemperature, setDiffTemperature] = useState(''); // Celsius
  const [cyclesOfConcentration, setCyclesOfConcentration] = useState(''); // Always visible now

  // --- Calculated Flow States (New) ---
  const [calculatedEvaporation, setCalculatedEvaporation] = useState(null); // m3/hr
  const [calculatedBlowdown, setCalculatedBlowdown] = useState(null); // m3/hr
  const [calculatedMakeup, setCalculatedMakeup] = useState(null); // m3/hr
  const [calculatedFlowType, setCalculatedFlowType] = useState('use_calculated_makeup'); // 'use_calculated_makeup', 'use_calculated_blowdown'

  // --- Result States for Acid Usage ---
  const [acidUsageKgHr, setAcidUsageKgHr] = useState(null); // kg/hr
  const [acidUsageKgDay, setAcidUsageKgDay] = useState(null); // kg/day
  const [acidUsageKgMonth, setAcidUsageKgMonth] = useState(null); // kg/month

  // --- UI States ---
  const [message, setMessage] = useState(''); // State for custom message box

  // Constants for acid properties and CaCO3 equivalent weight
  const EW_CaCO3 = 50.045; // g/equivalent

  const ACID_PROPERTIES = {
    sulfuric: {
      name: '98% Sulfuric Acid',
      equivWeight: 49.04, // H2SO4: MW=98.08, Valence=2. EW = 98.08/2 = 49.04 g/equiv
      density: 1.84, // kg/L (Density of 98% H2SO4)
      purity: 0.98,
    },
    hydrochloric: {
      name: '35% Hydrochloric Acid',
      equivWeight: 36.46, // HCl: MW=36.46, Valence=1. EW = 36.46/1 = 36.46 g/equiv
      density: 1.18, // kg/L (Density of 35% HCl)
      purity: 0.35,
    },
  };

  // Function to calculate Evaporation, Blowdown, and Makeup from CW Data
  // Wrapped with useCallback to memoize it, so it only changes when its dependencies change
  const calculateCoolingWaterFlows = useCallback(() => {
    const recircFlow = parseFloat(recirculationFlow);
    const deltaT = parseFloat(diffTemperature);
    const cycles = parseFloat(cyclesOfConcentration);

    if (isNaN(recircFlow) || isNaN(deltaT) || isNaN(cycles) || cycles <= 1) {
      setCalculatedEvaporation(null);
      setCalculatedBlowdown(null);
      setCalculatedMakeup(null);
      // Suppress for live input, main validation handles
      // if (cycles <= 1 && !isNaN(cycles)) {
      //   setMessage('Cycles of Concentration must be greater than 1 for accurate blowdown calculation.');
      // }
      return;
    }

    // Evaporation = 0.85% * recirculation flow * Diff temperature / 5.5
    // Ensure 0.85% is 0.0085 in calculation
    const evap_m3_hr = (0.0085 * recircFlow * deltaT) / 5.5;

    // Blowdown = Evaporation / (cycle of concentration -1)
    const blowdown_m3_hr = evap_m3_hr / (cycles - 1);

    // Makeup = Evaporation + blowdown
    const makeup_m3_hr = evap_m3_hr + blowdown_m3_hr;

    setCalculatedEvaporation(evap_m3_hr);
    setCalculatedBlowdown(blowdown_m3_hr);
    setCalculatedMakeup(makeup_m3_hr);
  }, [recirculationFlow, diffTemperature, cyclesOfConcentration]); // Dependencies for useCallback

  // Effect to recalculate CW data whenever relevant inputs change
  // Now includes calculateCoolingWaterFlows in its dependency array
  useEffect(() => {
    if (calculationBase === 'cw_data') {
      calculateCoolingWaterFlows();
    } else {
      // Clear calculated CW flows if not in CW data mode
      setCalculatedEvaporation(null);
      setCalculatedBlowdown(null);
      setCalculatedMakeup(null);
    }
  }, [calculationBase, calculateCoolingWaterFlows]); // Fixed: Added calculateCoolingWaterFlows as a dependency

  // Function to handle the main acid calculation
  const calculateAcidUsage = () => {
    // Determine the actual flow rate (m³/hr) to use for acid calculation
    let effectiveFlowRate_m3_hr;
    const cycles = parseFloat(cyclesOfConcentration); // Always need cycles for acid calculation

    if (calculationBase === 'manual_makeup' || calculationBase === 'manual_blowdown') {
      effectiveFlowRate_m3_hr = parseFloat(manualFlowRate);
    } else { // 'cw_data'
      calculateCoolingWaterFlows(); // Ensure flows are calculated just before usage
      if (calculatedMakeup === null || calculatedBlowdown === null) {
        setMessage('Please ensure all Cooling Water Data inputs are valid to calculate flows.');
        return;
      }
      effectiveFlowRate_m3_hr = calculatedFlowType === 'use_calculated_makeup' ? calculatedMakeup : calculatedBlowdown;
    }

    // --- Input Validation ---
    const alkMakeup = parseFloat(alkalinityMakeup);
    const alkDesired = parseFloat(alkalinityDesired);

    if (isNaN(alkMakeup) || isNaN(alkDesired) || isNaN(effectiveFlowRate_m3_hr) || isNaN(cycles)) {
      setMessage('Please enter valid numeric values for all required fields.');
      return;
    }
    if (alkMakeup < 0 || alkDesired < 0 || effectiveFlowRate_m3_hr < 0 || cycles <= 0) {
      setMessage('Alkalinity, flow rates, and cycles of concentration must be positive numbers. Cycles must be greater than 0.');
      return;
    }
    if (cycles <= 1 && calculationBase === 'cw_data') { // Specific check for CW data blowdown
        setMessage('Cycles of Concentration must be greater than 1 when calculating Blowdown from CW data.');
        return;
    }


    // Calculate the alkalinity that should enter the system (in makeup water)
    // to achieve the desired alkalinity in the cooling water at given cycles.
    const targetAlkalinityInMakeup = alkDesired / cycles;

    // The amount of alkalinity to neutralize in the makeup water
    const deltaAlk = alkMakeup - targetAlkalinityInMakeup;

    // If no alkalinity reduction is needed (makeup alkalinity is already at or below target), set usage to 0
    if (deltaAlk <= 0) {
      setAcidUsageKgHr(0);
      setAcidUsageKgDay(0);
      setAcidUsageKgMonth(0);
      setMessage('Desired cooling water alkalinity is achievable with current makeup water alkalinity or no acid needed. No acid addition required.');
      return;
    }

    const acid = ACID_PROPERTIES[acidType];

    // Convert effective flow rate from m³/hr to L/day for the primary calculation step
    let effectiveFlowRate_L_per_day;

    if (calculationBase === 'manual_makeup' || (calculationBase === 'cw_data' && calculatedFlowType === 'use_calculated_makeup')) {
        // If we are using Makeup Flow (manual or calculated), it's the effective flow
        effectiveFlowRate_L_per_day = effectiveFlowRate_m3_hr * 1000 * 24; // m3/hr to L/day
    } else { // 'manual_blowdown' or ('cw_data' and 'use_calculated_blowdown')
        // If we are using Blowdown Flow (manual or calculated), derive makeup flow
        effectiveFlowRate_L_per_day = effectiveFlowRate_m3_hr * 1000 * 24 * cycles; // Blowdown L/day * Cycles = Makeup L/day
    }


    // 1. Total alkalinity to neutralize per day (mg CaCO3 equivalent)
    const totalAlkalinityToNeutralize_mg_per_day = deltaAlk * effectiveFlowRate_L_per_day;

    // 2. Mass of pure acid required per day (grams)
    // Convert mg CaCO3 to g CaCO3 and then use the ratio of equivalent weights
    const massPureAcid_g_per_day = (totalAlkalinityToNeutralize_mg_per_day / 1000) * (acid.equivWeight / EW_CaCO3);

    // 3. Mass of commercial acid required per day (kg)
    const massCommercialAcid_kg_per_day = (massPureAcid_g_per_day / 1000) / acid.purity;

    // Derive other units
    const massCommercialAcid_kg_per_hr = massCommercialAcid_kg_per_day / 24;
    const massCommercialAcid_kg_per_month = massCommercialAcid_kg_per_day * 30; // 30 days per month

    setAcidUsageKgHr(massCommercialAcid_kg_per_hr);
    setAcidUsageKgDay(massCommercialAcid_kg_per_day);
    setAcidUsageKgMonth(massCommercialAcid_kg_per_month);
  };

  // Function to reset all input fields and results
  const resetFields = () => {
    setAlkalinityMakeup('');
    setAlkalinityDesired('');
    setAcidType('sulfuric');
    setCalculationBase('manual_makeup');
    setManualFlowRate('');
    setRecirculationFlow('');
    setDiffTemperature('');
    setCyclesOfConcentration('');
    setCalculatedEvaporation(null);
    setCalculatedBlowdown(null);
    setCalculatedMakeup(null);
    setCalculatedFlowType('use_calculated_makeup');
    setAcidUsageKgHr(null);
    setAcidUsageKgDay(null);
    setAcidUsageKgMonth(null);
    setMessage('');
  };

  // Render the component
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4 sm:p-6 font-sans">
      {/* Header */}
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-2">
            Cooling Water Acid Dosage Calculator
          </h1>
          <p className="text-gray-600 font-medium">
            Created by <span className="text-blue-600 font-semibold">Unnop Tongya</span>
          </p>
        </div>

        {/* Main Calculator Card */}
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
          {/* Card Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
            <h2 className="text-xl font-bold text-white flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Calculation Parameters
            </h2>
          </div>

          <div className="p-6 space-y-6">
            {/* Input Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Alkalinity Inputs */}
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100">
                  <label htmlFor="alkalinityMakeup" className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
                    <svg className="w-4 h-4 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                    </svg>
                    Makeup Water Alkalinity
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      id="alkalinityMakeup"
                      value={alkalinityMakeup}
                      onChange={(e) => setAlkalinityMakeup(e.target.value)}
                      placeholder="e.g., 200"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm appearance-none [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-outer-spin-button]:m-0 transition-all duration-200"
                      min="0"
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">
                      mg/L CaCO₃
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-xl border border-green-100">
                  <label htmlFor="alkalinityDesired" className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
                    <svg className="w-4 h-4 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Desired Cooling Water Alkalinity
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      id="alkalinityDesired"
                      value={alkalinityDesired}
                      onChange={(e) => setAlkalinityDesired(e.target.value)}
                      placeholder="e.g., 50"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm appearance-none [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-outer-spin-button]:m-0 transition-all duration-200"
                      min="0"
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">
                      mg/L CaCO₃
                    </div>
                  </div>
                </div>
              </div>

              {/* System Parameters */}
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-purple-50 to-violet-50 p-4 rounded-xl border border-purple-100">
                  <label htmlFor="cyclesOfConcentration" className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
                    <svg className="w-4 h-4 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Cycles of Concentration
                  </label>
                  <input
                    type="number"
                    id="cyclesOfConcentration"
                    value={cyclesOfConcentration}
                    onChange={(e) => setCyclesOfConcentration(e.target.value)}
                    placeholder="e.g., 4"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm appearance-none [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-outer-spin-button]:m-0 transition-all duration-200"
                    min="0"
                  />
                </div>

                <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-4 rounded-xl border border-orange-100">
                  <label htmlFor="acidType" className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
                    <svg className="w-4 h-4 mr-2 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                    Acid Type
                  </label>
                  <select
                    id="acidType"
                    value={acidType}
                    onChange={(e) => setAcidType(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm bg-white transition-all duration-200"
                  >
                    <option value="sulfuric">98% Sulfuric Acid (H₂SO₄)</option>
                    <option value="hydrochloric">35% Hydrochloric Acid (HCl)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Calculation Method Selection */}
            <div className="bg-gradient-to-r from-gray-50 to-slate-50 p-6 rounded-xl border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Calculation Method
              </h3>
              <select
                id="calculationBase"
                value={calculationBase}
                onChange={(e) => {
                  setCalculationBase(e.target.value);
                  setManualFlowRate(''); // Clear manual flow if switching modes
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-gray-500 focus:border-gray-500 text-sm bg-white transition-all duration-200"
              >
                <option value="manual_makeup">Manual Makeup Flow Rate</option>
                <option value="manual_blowdown">Manual Blowdown Rate</option>
                <option value="cw_data">Use Cooling Water Data</option>
              </select>
            </div>

            {/* Conditional Inputs for Cooling Water Data */}
            {calculationBase === 'cw_data' && (
              <div className="bg-gradient-to-r from-cyan-50 to-blue-50 p-6 rounded-xl border border-cyan-200">
                <h3 className="text-lg font-semibold text-cyan-800 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Cooling Water System Data
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="recirculationFlow" className="block text-sm font-medium text-gray-700 mb-2">
                      Recirculation Flow
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        id="recirculationFlow"
                        value={recirculationFlow}
                        onChange={(e) => setRecirculationFlow(e.target.value)}
                        placeholder="e.g., 1000"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-sm appearance-none [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-outer-spin-button]:m-0 transition-all duration-200"
                        min="0"
                      />
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">
                        m³/hr
                      </div>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="diffTemperature" className="block text-sm font-medium text-gray-700 mb-2">
                      Temperature Difference
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        id="diffTemperature"
                        value={diffTemperature}
                        onChange={(e) => setDiffTemperature(e.target.value)}
                        placeholder="e.g., 10"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-sm appearance-none [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-outer-spin-button]:m-0 transition-all duration-200"
                        min="0"
                      />
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">
                        °C
                      </div>
                    </div>
                  </div>
                </div>

                {/* Display Calculated CW Flows */}
                {(calculatedEvaporation !== null && calculatedBlowdown !== null && calculatedMakeup !== null) && (
                  <div className="mt-4 p-4 bg-white border border-cyan-300 rounded-lg shadow-sm">
                    <h4 className="font-semibold text-cyan-800 mb-3 flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Calculated Flow Rates
                    </h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-cyan-600 font-semibold">{calculatedEvaporation.toFixed(2)}</div>
                        <div className="text-gray-500">Evaporation (m³/hr)</div>
                      </div>
                      <div className="text-center">
                        <div className="text-cyan-600 font-semibold">{calculatedBlowdown.toFixed(2)}</div>
                        <div className="text-gray-500">Blowdown (m³/hr)</div>
                      </div>
                      <div className="text-center">
                        <div className="text-cyan-600 font-semibold">{calculatedMakeup.toFixed(2)}</div>
                        <div className="text-gray-500">Makeup (m³/hr)</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Dropdown for which calculated flow to use */}
                <div className="mt-4">
                  <label htmlFor="calculatedFlowType" className="block text-sm font-medium text-gray-700 mb-2">
                    Use this calculated flow for acid dosage:
                  </label>
                  <select
                    id="calculatedFlowType"
                    value={calculatedFlowType}
                    onChange={(e) => setCalculatedFlowType(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-sm bg-white transition-all duration-200"
                  >
                    <option value="use_calculated_makeup">Calculated Makeup Flow</option>
                    <option value="use_calculated_blowdown">Calculated Blowdown Flow</option>
                  </select>
                </div>
              </div>
            )}

            {/* Flow Rate Input */}
            <div className="bg-gradient-to-r from-teal-50 to-cyan-50 p-4 rounded-xl border border-teal-100">
              <label htmlFor="flowRate" className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
                <svg className="w-4 h-4 mr-2 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {calculationBase === 'manual_makeup' ? 'Manual Makeup Flow Rate' : 'Manual Blowdown Rate'}
                {calculationBase === 'cw_data' &&
                  (calculatedFlowType === 'use_calculated_makeup' ? ' (Calculated Makeup Flow)' : ' (Calculated Blowdown Flow)')
                }
              </label>
              <div className="relative">
                <input
                  type="number"
                  id="flowRate"
                  value={calculationBase === 'cw_data'
                    ? (calculatedFlowType === 'use_calculated_makeup' ? (calculatedMakeup !== null ? calculatedMakeup.toFixed(2) : '') : (calculatedBlowdown !== null ? calculatedBlowdown.toFixed(2) : ''))
                    : manualFlowRate
                  }
                  onChange={(e) => setManualFlowRate(e.target.value)}
                  placeholder="e.g., 500"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm appearance-none [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-outer-spin-button]:m-0 transition-all duration-200"
                  min="0"
                  disabled={calculationBase === 'cw_data'}
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">
                  m³/hr
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
              <button
                onClick={calculateAcidUsage}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-300 flex items-center justify-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Calculate Acid Usage
              </button>
              <button
                onClick={resetFields}
                className="flex-1 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-gray-300 flex items-center justify-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reset All Fields
              </button>
            </div>
          </div>
        </div>

        {/* Result Display */}
        {acidUsageKgDay !== null && (
          <div className="mt-8 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4">
              <h2 className="text-xl font-bold text-white flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Calculation Results
              </h2>
            </div>
            <div className="p-6">
              {acidUsageKgDay === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-green-800 mb-2">No Acid Required</h3>
                  <p className="text-green-700">Desired cooling water alkalinity is achievable with current makeup water alkalinity.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200 text-center">
                      <div className="text-2xl font-bold text-blue-600 mb-1">{acidUsageKgHr.toFixed(2)}</div>
                      <div className="text-sm text-blue-700 font-medium">kg/hr</div>
                      <div className="text-xs text-blue-600 mt-1">Hourly Usage</div>
                    </div>
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200 text-center">
                      <div className="text-2xl font-bold text-green-600 mb-1">{acidUsageKgDay.toFixed(2)}</div>
                      <div className="text-sm text-green-700 font-medium">kg/day</div>
                      <div className="text-xs text-green-600 mt-1">Daily Usage</div>
                    </div>
                    <div className="bg-gradient-to-r from-purple-50 to-violet-50 p-4 rounded-xl border border-purple-200 text-center">
                      <div className="text-2xl font-bold text-purple-600 mb-1">{acidUsageKgMonth.toFixed(2)}</div>
                      <div className="text-sm text-purple-700 font-medium">kg/month</div>
                      <div className="text-xs text-purple-600 mt-1">Monthly Usage</div>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-600 text-center">
                      <strong>Acid Type:</strong> {ACID_PROPERTIES[acidType].name}
                    </p>
                    <p className="text-xs text-gray-500 text-center mt-1">
                      This calculation determines the acid needed to achieve the desired alkalinity in the cooling water, considering makeup and cycles of concentration.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Custom Message Box */}
      <MessageBox message={message} onClose={() => setMessage('')} />
    </div>
  );
};

export default App;
