export const ScenarioCards = ({
    availableRuns,
    setSelectedRunId,
    runExperiment,
    fetchMetrics,
    status,
    sc,
    selectedRunId,
    durationSecByScenario,
    setDurationSecByScenario,
    scenarioLabels,
    runningUntilByScenario,
    nowTick,
    runModeByScenario,
    setRunModeByScenario,
    isLaunching,
    isFetchingMetrics
}) => {
    const supportsSaturation = ["Scenario1", "Scenario2", "Scenario3"].includes(sc);
    const selectedMode = runModeByScenario?.[sc] || "normal";
    const isSaturationMode = supportsSaturation && selectedMode === "saturation";
    const endAt = runningUntilByScenario?.[sc];
    const remainingMs = endAt ? Math.max(0, endAt - nowTick) : 0;
    const remainingMin = Math.floor(remainingMs / 60000);
    const remainingSec = Math.floor((remainingMs % 60000) / 1000);
    const remainingText = endAt && remainingMs > 0
        ? `Осталось ${String(remainingMin).padStart(2, "0")}:${String(remainingSec).padStart(2, "0")}`
        : null;

    return (
        <div key={sc} className="scenario-card" style={{ display: "flex", flexDirection: "column" }}>
            <h3 className="scenario-title">{scenarioLabels?.[sc] || sc}</h3>
            <button
                onClick={() => runExperiment(sc, durationSecByScenario[sc], runModeByScenario?.[sc] || "normal")}
                className={`scenario-run-btn ${isLaunching ? "loading" : ""}`}
                disabled={isLaunching}
            >
                {isLaunching ? "Запуск..." : "Запустить тест"}
            </button>

            <div style={{ marginTop: "15px" }}>
                {supportsSaturation && (
                    <>
                        <label className="scenario-label">Режим:</label>
                        <select
                            value={runModeByScenario?.[sc] || "normal"}
                            onChange={(e) =>
                                setRunModeByScenario((prev) => ({ ...prev, [sc]: e.target.value }))
                            }
                            className="scenario-select"
                        >
                            <option value="normal">Обычный</option>
                            <option value="saturation">Saturation</option>
                        </select>
                    </>
                )}
            </div>

            {(!supportsSaturation || !isSaturationMode) && (
                <div style={{ marginTop: "15px" }}>
                    <label className="scenario-label">Длительность:</label>
                    <select
                        value={durationSecByScenario[sc]}
                        onChange={(e) =>
                            setDurationSecByScenario((prev) => ({ ...prev, [sc]: Number(e.target.value) }))
                        }
                        className="scenario-select"
                    >
                        <option value={60}>1 минута</option>
                        <option value={300}>5 минут</option>
                        <option value={600}>10 минут</option>
                        <option value={1800}>30 минут</option>
                    </select>
                </div>
            )}
            {isSaturationMode && (
                <div className="scenario-remaining" style={{ marginTop: "15px" }}>
                    Длительность фиксируется стадиями Saturation (по шагам нагрузки).
                </div>
            )}
            {remainingText && (
                <div className="scenario-remaining">{remainingText}</div>
            )}

            <div style={{ marginTop: "15px" }}>
                <label className="scenario-label">Запуск:</label>
                <select
                    value={selectedRunId[sc]}
                    onChange={(e) => setSelectedRunId(prev => ({ ...prev, [sc]: e.target.value }))}
                    className="scenario-select"
                >
                    <option value="">-- Выбрать --</option>
                    {availableRuns[sc].map(id => <option key={id} value={id}>{id}</option>)}
                </select>
            </div>

            <button
                onClick={() => fetchMetrics(sc)}
                className={`scenario-metrics-btn ${isFetchingMetrics ? "loading" : ""}`}
                disabled={isFetchingMetrics}
            >
                {isFetchingMetrics ? "Загрузка..." : "Метрики"}
            </button>
            <p className="scenario-status">{status[sc]}</p>
        </div>
    );
};
