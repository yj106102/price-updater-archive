# price-updater-archive
## 정보
- 코드 작성: 트리니티벤쳐스튜디오, 2023.06 ~ 07
- 작성 목적: 탈중앙화 암호화폐 거래소에서 사용하려는 가격정보를 불러오기 위함.
## 구조
- primary.js
  >node를 통해 실행하게 되는 entry 프로그램. primary에서 worker 프로세스를 여러 개 실행하게 되며 각 worker이 보내오는 데이터를 받아와 정리한다.

- worker.js
  >primary에 의해 호출되는 프로그램. 하나의 worker은 하나의 provider(중앙화 거래소)와 websocket으로 연결되어 있으며 websocket으로 얻은 데이터를 primary로 전송한다.

- pyth-worker.js
  >worker.js와 비슷하지만 Pyth oracle에서 정보를 받아온다.

- constants.js
  >여러 상수 값들을 저장한 파일. 여기에서 거래소 목록이나 암호화폐 목록 등을 수정할 수 있다.
## 사용법
```
node primary.js (OPERATION_MODE) (PRICE_AGGREGATION_MODE)
```
### OPERATION_MODES
- PRICE : 각 거래소 가격 출력
- AGG_PRICE : 각 거래소 가격 + 거래소의 평균 가격 출력
- TIME : 각 거래소와 거래쌍에 대해 평균 response 시간 출력 
- EXCHANGE_DIFF : 각 거래소의 가격과 평균 가격과의 차이 %의 최댓값과 최댓값이 발생한 시간과 그때 각 거래소의 가격 출력
- PYTH_DIFF : Pyth Oracle과의 가격 차이 출력
- COUNT : 각 거래소, 거래쌍의 총 resopnse 횟수 출력
기본값 : AGG_PRICE

### PRICE_AGGREGATION_MODE
- TRIMMED_MEAN : 최대 n개 / 최소 n개의 거래소 가격 제외
- WEIGHTED_MEAN : 거래소 24시간 거래량 가중치 평균 가격
- TRIMMED_WEIGHTED_MEAN : 위의 두 개 동시에 적용
- 기본값: TRIMMED_WEIGHTED_MEAN

## 사용 예시

```
node primary.js
```
>거래소의 가격의 종합치를 TRIMMED_WEIGHTED 방식으로 계산해 출력함

```
node primary.js AGG_PRICE TRIMMED_MEAN
```
  >거래소의 가격의 종합치를 TRIMMED 방식으로 계산해 출력함
  ```
node primary.js COUNT
```
  >각 거래소와 거래쌍의 총 response 횟수를 출력함
## 한계점
- 프로그램이 완성 단계가 아니었기 때문에 여러 한계점이 있음.
  - WEIGHTED_MEAN 미구현
  - 처음에 거래소, 거래쌍 별 거래량을 불러오는 과정은 멀티프로세스로 분리되지 못해 초기 셋팅 시간이 오래 걸림.
  - 주석 처리/ 포매팅 등
