import {useEffect, useState} from "react";
import html2canvas from "html2canvas";
import {saveAs} from 'file-saver';
import Highcharts from 'highcharts';
import HighchartsMap from 'highcharts/modules/map';

const JSZip = require('jszip');
HighchartsMap(Highcharts);

const distance = (lat1, lon1, lat2, lon2) => {
    let r = 6371;
    lon1 = lon1 * Math.PI / 180;
    lon2 = lon2 * Math.PI / 180;
    lat1 = lat1 * Math.PI / 180;
    lat2 = lat2 * Math.PI / 180;

    let d_lon = lon2 - lon1;
    let d_lat = lat2 - lat1;
    let a = Math.pow(Math.sin(d_lat / 2), 2)
        + Math.cos(lat1) * Math.cos(lat2)
        * Math.pow(Math.sin(d_lon / 2), 2);
    let c = 2 * Math.asin(Math.sqrt(a));

    return (c * r);
}

const center = (arr) => {
    let x = 0, y = 0;
    const allCoordinates = arr.flat(3);
    const length = allCoordinates.length / 2;

    allCoordinates.forEach((element, i) => {
        if (i % 2 === 0)
            x += element;
        else
            y += element;
    });

    return [x / length, y / length];
}

const App = () => {
    const [data, setData] = useState({});
    const [next, setNext] = useState(0);
    const [text, setText] = useState("");
    const [isChecked, setIsChecked] = useState(false);
    const [finished, setFinished] = useState(false);
    const [provincesMap, setProvincesMap] = useState({});
    const mostVotedProvinces = ["Granada"];
    const RIOT_PROBABILITY = 30;
    const [exportPromises, setExportPromises] = useState([]);
    const [imagePaths, setImagePaths] = useState([]);

    useEffect(() => {
        if (next === 0) {
            fetch("https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/spain-provinces.geojson")
                .then(res => res.json())
                .then(json => {
                    setData(json);
                    const provincesAux = {};
                    json.features.forEach(p => {
                        provincesAux[randomColor()] = [p.properties.name];
                    });

                    setProvincesMap(provincesAux);
                });
        } else if (next > 1) {
            play();
        }
    }, [next]);

    const getRandomProvince = (provincesInArray) => {
        const random = Math.floor(Math.random() * provincesInArray.length);
        return provincesInArray[random];
    }

    const getKeys = (array) => {
        return Object.keys(array);
    }

    const getEntries = (array) => {
        return Object.entries(array);
    }

    const getValues = (array) => {
        return Object.values(array);
    }

    const chartOptions = {
        chart: {
            map: data,
            width: window.innerWidth - 300,
            height: window.innerHeight,
            backgroundColor: "#76a3ff"
        },
        title: {
            text: `${text}`,
            style: {
                color: "#fff",
                fontSize: 25
            }
        },
        mapView: {
            projection: {
                name: "WebMercator"
            },
            center: [-3, 40],
            zoom: 6.2
        },
        exporting: {
            enabled: false
        },
        series: [{
            showInLegend: false,
            data: getKeys(provincesMap).reduce((acc, color) => {
                provincesMap[color].forEach(province => {
                    acc.push({name: province, color: color});
                });
                return acc;
            }, []),
            joinBy: "name",
            keys: ["name", "color"],
            dataLabels: {
                enabled: true,
                formatter: function () {
                    if (next === 0)
                        return this.point.name;
                    else {
                        const capitalCities = Object.values(provincesMap).sort((a, b) => b.length - a.length)
                            .slice(0, 10).flatMap(p => p[0]).join(",");
                        return capitalCities.includes(this.point.name) ? this.point.name : "";
                    }
                }
            }
        }]
    };

    const drawMap = () => {
        Highcharts.mapChart("map", chartOptions);
    }

    const riot = () => {
        const random = Math.floor(Math.random() * RIOT_PROBABILITY);

        if (random === 1) {
            const newProvincesMap = {...provincesMap};

            const randomColor = chooseRandomColor();
            const cities = getValues(newProvincesMap[randomColor]);
            const randomCity = Math.floor(Math.random() * cities.length);
            const previousCity = cities[randomCity];
            const capitalCity = cities[0];

            if (previousCity !== capitalCity && cities.length > 5) {
                let temp = cities[randomCity];
                cities[randomCity] = cities[0];
                cities[0] = temp;

                newProvincesMap[randomColor] = cities;
                setProvincesMap(newProvincesMap);
                console.log(`¡Ha habido un motín! ${previousCity} se ha revelado contra la capital ${capitalCity} y ha tomado el control.`)

                setText(`¡Ha habido un motín! ${previousCity} se ha revelado contra la capital ${capitalCity} y ha tomado el control.`);
                return true;
            }
        }

        return false
    }

    const play = () => {
        const provincesMapLength = getEntries(provincesMap).length;

        if (provincesMapLength > 1) {
            let randomProvinceColor;
            let closestProvinceColor;
            let randomProvinceName;
            let closestProvinceName;
            let closestProvince;
            let randomProvince;

            drawMap();

            const isRiot = riot();

            if (!isRiot) {
                do {
                    randomProvinceColor = chooseRandomColor();
                    randomProvinceName = getRandomProvince(provincesMap[randomProvinceColor])
                    randomProvince = {[randomProvinceColor]: provincesMap[randomProvinceColor]}
                    const closestProvinces = getClosestProvinces(randomProvinceName);
                    closestProvinceName = chooseRandomProvince(closestProvinces).properties.name
                    closestProvinceColor = getKeys(provincesMap).find(key => provincesMap[key].includes(closestProvinceName));
                    closestProvince = {[closestProvinceColor]: provincesMap[closestProvinceColor]}
                } while (randomProvinceColor === closestProvinceColor)

                battle(randomProvince, randomProvinceName, closestProvince, closestProvinceName)

            }
        } else {
            setText(`¡${getValues(provincesMap)[0][0]} ha ganado la guerra!`)
            drawMap();
            setFinished(true);
        }

        if (isChecked) {
            setExportPromises(prevPromises => [...prevPromises, exportToPng()]);
        }

        if(!finished) {
            setNext(next + 1);
        }
    };

    const chooseRandomColor = () => {
        const random = Math.floor(Math.random() * getEntries(provincesMap).length);
        return getEntries(provincesMap)[random][0];
    }

    const chooseRandomProvince = (provinces) => {
        const random = Math.floor(Math.random() * provinces.length);
        return provinces[random];
    }

    const randomColor = () => {
        const r = Math.floor(Math.random() * 156) + 100;
        const g = Math.floor(Math.random() * 156) + 100;
        const b = Math.floor(Math.random() * 156) + 100;

        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    };

    const boostBestKingdom = (randomArray, province) => {
        if (province !== undefined && getValues(province).length > 26) {
            for (let i = 0; i < 2; i++)
                randomArray.push(getKeys(province)[0])
        }
    }

    const boostMostVoted = (randomProvinceName, randomProvince, randomArray) => {
        if (mostVotedProvinces.includes(randomProvinceName))
            randomArray.push(getKeys(randomProvince)[0])
    }

    const battle = (randomProvince, randomProvinceName, closestProvince, closestProvinceName) => {
        let randomArray = [];
        const newProvincesMap = {...provincesMap};
        getValues(randomProvince)[0].forEach(p => randomArray.push(getKeys(randomProvince)[0]))
        getValues(closestProvince)[0].forEach(p => randomArray.push(getKeys(closestProvince)[0]))

        boostMostVoted(randomProvinceName, randomProvince, randomArray);
        boostMostVoted(closestProvinceName, closestProvince, randomArray);
        boostBestKingdom(randomProvince)
        boostBestKingdom(closestProvince)

        const randomNumber = Math.floor(Math.random() * randomArray.length);
        const winnerColor = randomArray[randomNumber];
        const loserColor = winnerColor !== getKeys(randomProvince)[0]
            ? getKeys(randomProvince)[0]
            : getKeys(closestProvince)[0];
        const loserName = provincesMap[loserColor].includes(closestProvinceName)
            ? closestProvinceName
            : randomProvinceName

        newProvincesMap[winnerColor].push(loserName);
        newProvincesMap[loserColor] = newProvincesMap[loserColor].filter(p => p !== loserName);
        setProvincesMap(newProvincesMap);

        const filteredProvincesMap = Object.fromEntries(
            getEntries(newProvincesMap).filter(([_, provinces]) => provinces.length > 0)
        );

        setProvincesMap(filteredProvincesMap);
        setText(`Día ${next} de la Gran Guerra. ${randomProvinceName} ataca a ${closestProvinceName}. Pierde ${loserName}`)
    }

    const getClosestProvinces = (provinceName) => {
        const provinceData = data.features.find(p => p.properties.name === provinceName);
        const provinceLatLon = center(provinceData.geometry.coordinates);

        if (data.features) {
            const sortedProvinces = data.features
                .filter(element => element.properties.name !== provinceName)
                .map(element => {
                    const elementLatLon = center(element.geometry.coordinates);
                    const d = distance(provinceLatLon[1], provinceLatLon[0], elementLatLon[1], elementLatLon[0]);
                    return {province: element, distance: d};
                })
                .sort((a, b) => a.distance - b.distance)
                .slice(0, 4)
                .map(entry => entry.province);

            return sortedProvinces;
        }

        return [];
    }

    const exportAllData = async () => {
        await Promise.all(exportPromises)
            .then(() => {
                exportImagesToZip();
            })
            .catch(error => {
                console.error("Error: ", error);
            });
    };

    const exportToPng = () => {
        const chartElement = document.querySelector("#total");

        return new Promise((resolve, reject) => {
            html2canvas(chartElement).then(canvas => {
                canvas.toBlob(blob => {
                    const imagePath = `image-${next}.png`;
                    setImagePaths(prevPaths => [...prevPaths, {path: imagePath, blob}]);
                    resolve();
                }, 'image/png');
            }).catch(error => {
                reject(error);
            });
        });
    };

    const exportImagesToZip = () => {
        if (imagePaths.length === 0) {
            console.log("No images to export");
            return;
        }

        const zip = new JSZip();

        imagePaths.forEach(image => {
            zip.file(image.path, image.blob);
        });

        zip.generateAsync({type: "blob"}).then(content => {
            const zipName = "images.zip";
            saveAs(content, zipName);
        }).catch(error => {
            console.error("Error:", error);
        });
    };

    return (
        <div>
            <div id="total" style={{display: "flex", alignItems: "center", backgroundColor: "#76a3ff"}}>
                <div style={{flexWrap: "wrap", marginLeft: 100}}>
                    {getValues(provincesMap).sort((a, b) => b.length - a.length).slice(0, 10)
                        .map((p, index) => {
                            const color = getKeys(provincesMap).find(key => provincesMap[key].includes(p[0]));
                            return (
                                <div style={{backgroundColor: color, display: "flex", justifyContent: "center"}}>
                                    <p key={index} style={{
                                        color: "#fff",
                                        fontWeight: "bold",
                                        paddingLeft: 10,
                                        paddingRight: 10,
                                        fontSize: 18
                                    }}>{index + 1}.- {p[0].length < 15 ? p[0] : p[0].slice(0, 15) + "..."}</p>
                                </div>
                            );
                        })}
                </div>
                <div style={{marginLeft: "auto"}}>
                    <div id="map" style={{marginTop: 50}}></div>
                </div>
            </div>
            <div style={{display: "flex", alignItems: "center"}}>
                <button onClick={play}>Next</button>
                <p>Export all images</p>
                <input type="checkbox" checked={isChecked} onChange={() => setIsChecked(!isChecked)}/>
            </div>
        </div>
    );
};

export default App;
