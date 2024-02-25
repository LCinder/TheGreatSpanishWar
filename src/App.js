import {useEffect, useState} from "react";
import html2canvas from "html2canvas";
import {saveAs} from 'file-saver';

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
  const [provincesMap, setProvincesMap] = useState({});

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

  const chartOptions = {
    chart: {
      map: data,
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: "#76a3ff"
    },
    title: null,
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
      data: Object.keys(provincesMap).reduce((acc, color) => {
        provincesMap[color].forEach(province => {
          acc.push({name: province, color: color});
        });
        return acc;
      }, []),
      joinBy: "name",
      keys: ["name", "color"],
      dataLabels: {
        enabled: true,
        format: "{point.name}"
      },
    }]
  };

  function drawMap() {
    Highcharts.mapChart("map", chartOptions);
  }

  const play = () => {
    if (Object.entries(provincesMap).length > 1) {
      let randomProvinceColor;
      let closestProvinceColor;

      let randomProvinceName;
      let closestProvinceName;
      let closestProvince;
      let randomProvince;

      drawMap();
      do {
        randomProvinceColor = chooseRandomColor();
        randomProvinceName = getRandomProvince(provincesMap[randomProvinceColor])
        randomProvince = {[randomProvinceColor]: provincesMap[randomProvinceColor]}
        const closestProvinces = getClosestProvinces(randomProvinceName);
        closestProvinceName = chooseRandomProvince(closestProvinces).properties.name
        closestProvinceColor = Object.keys(provincesMap).find(key => provincesMap[key].includes(closestProvinceName));
        closestProvince = {[closestProvinceColor]: provincesMap[closestProvinceColor]}
      } while (randomProvinceColor === closestProvinceColor)

      battle(randomProvince, randomProvinceName, closestProvince, closestProvinceName)

      if(isChecked) {
        exportToPng();
      }

      setNext(next + 1);
    }
  };

  const chooseRandomColor = () => {
    const random = Math.floor(Math.random() * Object.entries(provincesMap).length);
    return Object.entries(provincesMap)[random][0];
  }

  const chooseRandomProvince = (provinces) => {
    const random = Math.floor(Math.random() * provinces.length);
    return provinces[random];
  }

  const randomColor = () => {
    return '#' + Math.floor(Math.random() * 16777215).toString(16);
  };

  const battle = (randomProvince, randomProvinceName, closestProvince, closestProvinceName) => {
    let randomArray = [];
    const newProvincesMap = {...provincesMap};
    const randomNumber = Math.floor(Math.random() * (Object.values(randomProvince).length + Object.values(closestProvince).length));
    Object.values(randomProvince).forEach(p => randomArray.push(Object.keys(randomProvince)[0]))
    Object.values(closestProvince).forEach(p => randomArray.push(Object.keys(closestProvince)[0]))

    const winnerColor = randomArray[randomNumber];
    const loserColor = winnerColor !== Object.keys(randomProvince)[0] ? Object.keys(randomProvince)[0] : Object.keys(closestProvince)[0];
    const loserName = provincesMap[loserColor].includes(closestProvinceName) ? closestProvinceName : randomProvinceName

    if (winnerColor !== loserColor) {
      newProvincesMap[winnerColor].push(loserName);
      newProvincesMap[loserColor] = newProvincesMap[loserColor].filter(p => p !== loserName);
      setProvincesMap(newProvincesMap);

      const filteredProvincesMap = Object.fromEntries(
          Object.entries(newProvincesMap).filter(([color, provinces]) => provinces.length > 0)
      );
      setProvincesMap(filteredProvincesMap);
    }

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

  const exportToPng = () => {
    const chartElement = document.querySelector("#total");

    html2canvas(chartElement).then(canvas => {
      canvas.toBlob(blob => {
        saveAs(blob, `./image-${next}`);
      }, 'image/png');
    });
  }

  return (
      <div>
        <div style={{ backgroundColor: "#76a3ff" }} id="total">
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {Object.values(provincesMap).map((p, index) => {
              const color = Object.keys(provincesMap).find(key => provincesMap[key].includes(p[0]));
              return (
                  <p key={index} style={{ color: color, fontWeight: "bold", marginRight: "10px" }}>{p[0]}</p>
              );
            })}
          </div>
          <div style={{ flex: "1" }}>
            <div style={{ display: "flex", marginBottom: 10 }}>
              <p style={{ color: "#fff", margin: "0 auto", fontWeight: "bold", fontSize: 20 }}>{text}</p>
            </div>
            <div id="map" style={{ marginTop: 0 }}></div>
          </div>
        </div>
        <button onClick={() => play()}>Next</button>
        <button onClick={() => exportToPng()}>Export Image</button>
        <button onClick={() => setNext(-1)}>Stop</button>
        <div>
          <p>Export all images</p>
          <input type="checkbox" checked={isChecked} onChange={() => setIsChecked(!isChecked)}/>
        </div>
      </div>
  );
};

export default App;
