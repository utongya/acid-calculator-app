import React, { useState, useEffect, useCallback } from 'react'; // Added useCallback

// A simple custom alert/message box component
const MessageBox = ({ message, onClose }) => {
  if (!message) return null;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-70 flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm mx-auto text-center transform scale-95 animate-zoom-in">
        <p className="text-lg font-semibold text-gray-800 mb-4">{message}</p>
        <button
          onClick={onClose}
          className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-800 text-white font-bold rounded-lg shadow-md hover:from-blue-700 hover:to-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition duration-300 ease-in-out transform hover:scale-105"
        >
          Got It!
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
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 p-4 sm:p-6 font-inter flex flex-col items-center justify-center">
      {/* Main Card Container */}
      <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 w-full max-w-md md:max-w-lg lg:max-w-xl border border-blue-200 transform transition-all duration-300 hover:shadow-3xl">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-800 text-center mb-2 leading-tight">
          Cooling Water Acid Dosage Calculator
        </h1>
        <p className="text-sm text-gray-600 text-center mb-6 font-medium">
          Created by Unnop Tongya
        </p>

        {/* Input Fields Section */}
        <div className="space-y-5">
          {/* Alkalinity Makeup */}
          <div>
            <label htmlFor="alkalinityMakeup" className="block text-sm font-semibold text-gray-700 mb-1">
              Alkalinity of Makeup Water (mg/L as CaCO₃)
            </label>
            <input
              type="number"
              id="alkalinityMakeup"
              value={alkalinityMakeup}
              onChange={(e) => setAlkalinityMakeup(e.target.value)}
              placeholder="e.g., 200"
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm appearance-none [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-outer-spin-button]:m-0 transition duration-200 focus:shadow-md"
              min="0"
            />
          </div>

          {/* Alkalinity Desired */}
          <div>
            <label htmlFor="alkalinityDesired" className="block text-sm font-semibold text-gray-700 mb-1">
              Desired Alkalinity in Cooling Water (mg/L as CaCO₃)
            </label>
            <input
              type="number"
              id="alkalinityDesired"
              value={alkalinityDesired}
              onChange={(e) => setAlkalinityDesired(e.target.value)}
              placeholder="e.g., 50"
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm appearance-none [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-outer-spin-button]:m-0 transition duration-200 focus:shadow-md"
              min="0"
            />
          </div>

          {/* Cycles of Concentration */}
          <div>
            <label htmlFor="cyclesOfConcentration" className="block text-sm font-semibold text-gray-700 mb-1">
                Cycles of Concentration
            </label>
            <input
              type="number"
              id="cyclesOfConcentration"
              value={cyclesOfConcentration}
              onChange={(e) => setCyclesOfConcentration(e.target.value)}
              placeholder="e.g., 4"
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm appearance-none [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-outer-spin-button]:m-0 transition duration-200 focus:shadow-md"
              min="0"
            />
          </div>

          {/* Type of Acid */}
          <div>
            <label htmlFor="acidType" className="block text-sm font-semibold text-gray-700 mb-1">
              Type of Acid
            </label>
            <div className="relative">
              <select
                id="acidType"
                value={acidType}
                onChange={(e) => setAcidType(e.target.value)}
                className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white pr-10 appearance-none transition duration-200 focus:shadow-md"
              >
                <option value="sulfuric">98% Sulfuric Acid (H₂SO₄)</option>
                <option value="hydrochloric">35% Hydrochloric Acid (HCl)</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
              </div>
            </div>
          </div>

          {/* New Calculation Base Dropdown */}
          <div>
            <label htmlFor="calculationBase" className="block text-sm font-semibold text-gray-700 mb-1">
              Calculate Flow based on
            </label>
            <div className="relative">
              <select
                id="calculationBase"
                value={calculationBase}
                onChange={(e) => {
                  setCalculationBase(e.target.value);
                  setManualFlowRate(''); // Clear manual flow if switching modes
                }}
                className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white pr-10 appearance-none transition duration-200 focus:shadow-md"
              >
                <option value="manual_makeup">Manual Makeup Flow Rate</option>
                <option value="manual_blowdown">Manual Blowdown Rate</option>
                <option value="cw_data">Use Cooling Water Data</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
              </div>
            </div>
          </div>

          {/* Conditional Inputs for Cooling Water Data */}
          {calculationBase === 'cw_data' && (
            <>
              <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl space-y-4 shadow-inner">
                <h3 className="text-lg font-bold text-blue-800 text-center">Cooling Water Flow Data</h3>
                <div>
                  <label htmlFor="recirculationFlow" className="block text-sm font-semibold text-gray-700 mb-1">
                    Recirculation Flow (m³/hr)
                  </label>
                  <input
                    type="number"
                    id="recirculationFlow"
                    value={recirculationFlow}
                    onChange={(e) => setRecirculationFlow(e.target.value)}
                    placeholder="e.g., 1000"
                    className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm appearance-none [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-outer-spin-button]:m-0 transition duration-200 focus:shadow-md"
                    min="0"
                  />
                </div>
                <div>
                  <label htmlFor="diffTemperature" className="block text-sm font-semibold text-gray-700 mb-1">
                    Temperature Difference (ΔT in °C)
                  </label>
                  <input
                    type="number"
                    id="diffTemperature"
                    value={diffTemperature}
                    onChange={(e) => setDiffTemperature(e.target.value)}
                    placeholder="e.g., 10"
                    className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm appearance-none [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-outer-spin-button]:m-0 transition duration-200 focus:shadow-md"
                    min="0"
                  />
                </div>

                {/* Display Calculated CW Flows */}
                {(calculatedEvaporation !== null && calculatedBlowdown !== null && calculatedMakeup !== null) && (
                  <div className="mt-4 p-3 bg-blue-100 border border-blue-300 rounded-lg text-sm text-blue-800 font-medium shadow-md">
                    <h4 className="font-bold text-blue-900 mb-1">Calculated Flows:</h4>
                    <p>Evaporation: <span className="font-semibold">{calculatedEvaporation.toFixed(2)} m³/hr</span></p>
                    <p>Blowdown: <span className="font-semibold">{calculatedBlowdown.toFixed(2)} m³/hr</span></p>
                    <p>Makeup: <span className="font-semibold">{calculatedMakeup.toFixed(2)} m³/hr</span></p>
                  </div>
                )}

                {/* Dropdown for which calculated flow to use */}
                <div>
                  <label htmlFor="calculatedFlowType" className="block text-sm font-semibold text-gray-700 mb-1">
                    Use this calculated flow for acid dosage:
                  </label>
                  <div className="relative">
                    <select
                      id="calculatedFlowType"
                      value={calculatedFlowType}
                      onChange={(e) => setCalculatedFlowType(e.target.value)}
                      className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white pr-10 appearance-none transition duration-200 focus:shadow-md"
                    >
                      <option value="use_calculated_makeup">Calculated Makeup Flow</option>
                      <option value="use_calculated_blowdown">Calculated Blowdown Flow</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                      <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Flow Rate Input (Manual or Display of Calculated) */}
          <div>
            <label htmlFor="flowRate" className="block text-sm font-semibold text-gray-700 mb-1">
              {calculationBase === 'manual_makeup' && 'Manual Makeup Flow Rate (m³/hr)'}
              {calculationBase === 'manual_blowdown' && 'Manual Blowdown Rate (m³/hr)'}
              {calculationBase === 'cw_data' &&
                (calculatedFlowType === 'use_calculated_makeup' ? 'Calculated Makeup Flow (m³/hr)' : 'Calculated Blowdown Flow (m³/hr)')
              }
            </label>
            <input
              type="number"
              id="flowRate"
              value={calculationBase === 'cw_data'
                ? (calculatedFlowType === 'use_calculated_makeup' ? (calculatedMakeup !== null ? calculatedMakeup.toFixed(2) : '') : (calculatedBlowdown !== null ? calculatedBlowdown.toFixed(2) : ''))
                : manualFlowRate
              }
              onChange={(e) => setManualFlowRate(e.target.value)}
              placeholder="e.g., 500"
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm appearance-none [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-outer-spin-button]:m-0 transition duration-200 focus:shadow-md"
              min="0"
              disabled={calculationBase === 'cw_data'} // Disable if using calculated flow
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
          <button
            onClick={calculateAcidUsage}
            className="w-full sm:flex-1 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
          >
            Calculate Acid Usage
          </button>
          <button
            onClick={resetFields}
            className="w-full sm:flex-1 bg-gradient-to-r from-gray-300 to-gray-400 hover:from-gray-400 hover:to-gray-500 text-gray-800 font-bold py-3 px-4 rounded-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-75"
          >
            Reset
          </button>
        </div>


        {/* Result Display */}
        {acidUsageKgDay !== null && (
          <div className="mt-8 p-5 bg-gradient-to-br from-green-50 to-teal-50 border border-green-200 rounded-xl text-center shadow-xl animate-fade-in">
            <h2 className="text-xl font-extrabold text-green-800 mb-3">Calculation Result</h2>
            {acidUsageKgDay === 0 ? (
              <p className="text-lg text-green-700 font-semibold">No acid required for pH adjustment.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-lg text-green-700">
                  Estimated Acid Usage (Hourly):{' '}
                  <span className="font-bold text-green-900 text-xl">
                    {acidUsageKgHr.toFixed(2)} kg/hr
                  </span>
                  <span className="text-green-800 block text-sm">of {ACID_PROPERTIES[acidType].name}</span>
                </p>
                <p className="text-lg text-green-700">
                  Estimated Acid Usage (Daily):{' '}
                  <span className="font-bold text-green-900 text-xl">
                    {acidUsageKgDay.toFixed(2)} kg/day
                  </span>
                  <span className="text-green-800 block text-sm">of {ACID_PROPERTIES[acidType].name}</span>
                </p>
                <p className="text-lg text-green-700">
                  Estimated Acid Usage (Monthly):{' '}
                  <span className="font-bold text-green-900 text-xl">
                    {acidUsageKgMonth.toFixed(2)} kg/month
                  </span>
                  <span className="text-green-800 block text-sm">of {ACID_PROPERTIES[acidType].name}</span>
                </p>
              </div>
            )}
            <p className="text-sm text-gray-600 mt-4">
              (This calculation determines the acid needed to achieve the desired alkalinity in the cooling water, considering makeup and cycles of concentration.)
            </p>
          </div>
        )}
      </div>

      {/* Custom Message Box */}
      <MessageBox message={message} onClose={() => setMessage('')} />
    </div>
  );
};

export default App;
